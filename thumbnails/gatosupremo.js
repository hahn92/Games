/* Miniatura de gatosupremo para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#1a2340'); bg.addColorStop(1, '#080d18');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var m = W * 0.82, ss = m / 3, cz = ss / 3, ox = (W - m) / 2, oy = (H - m) / 2 - 6;
            function mark(x, y, r, who) {
                ctx.lineWidth = Math.max(2, r * 0.28); ctx.lineCap = 'round';
                if (who === 1) {
                    ctx.strokeStyle = '#8fd3f4';
                    ctx.beginPath();
                    ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
                    ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
                    ctx.stroke();
                } else {
                    ctx.strokeStyle = '#ff8a3d';
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
                }
            }
            var boards = [1, 0, 2, 0, 1, 0, 0, 0, 2];
            for (var b = 0; b < 9; b++) {
                var bx = ox + (b % 3) * ss, by = oy + ((b / 3) | 0) * ss;
                if (boards[b] === 1) { ctx.fillStyle = 'rgba(143,211,244,0.16)'; ctx.fillRect(bx, by, ss, ss); }
                else if (boards[b] === 2) { ctx.fillStyle = 'rgba(255,138,61,0.16)'; ctx.fillRect(bx, by, ss, ss); }
                else if (b === 4 + 1) { ctx.fillStyle = 'rgba(143,211,244,0.10)'; ctx.fillRect(bx, by, ss, ss); }
                ctx.strokeStyle = 'rgba(180,200,225,0.18)'; ctx.lineWidth = 1;
                ctx.beginPath();
                for (var g = 1; g < 3; g++) {
                    ctx.moveTo(bx + g * cz, by + 3); ctx.lineTo(bx + g * cz, by + ss - 3);
                    ctx.moveTo(bx + 3, by + g * cz); ctx.lineTo(bx + ss - 3, by + g * cz);
                }
                ctx.stroke();
                if (boards[b]) mark(bx + ss / 2, by + ss / 2, ss * 0.3, boards[b] === 1 ? 1 : 2);
                else {
                    var picks = [[0, 1], [4, 2], [8, 1]];
                    for (var k = 0; k < picks.length; k++) {
                        if ((b + k) % 3) continue;
                        var i = picks[k][0];
                        mark(bx + (i % 3) * cz + cz / 2, by + ((i / 3) | 0) * cz + cz / 2, cz * 0.28, picks[k][1]);
                    }
                }
            }
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 3;
            ctx.beginPath();
            for (var q = 1; q < 3; q++) {
                ctx.moveTo(ox + q * ss, oy); ctx.lineTo(ox + q * ss, oy + m);
                ctx.moveTo(ox, oy + q * ss); ctx.lineTo(ox + m, oy + q * ss);
            }
            ctx.stroke();
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('GATO SUPREMO', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['gatosupremo'] = draw;
}());

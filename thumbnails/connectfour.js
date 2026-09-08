/* Miniatura de connectfour para el catálogo. La carga thumbnails.js bajo demanda,
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
            // board gradient
            var boardG = ctx.createLinearGradient(0, 0, 0, H);
            boardG.addColorStop(0, '#1976d2');
            boardG.addColorStop(1, '#0d47a1');
            ctx.fillStyle = boardG; ctx.fillRect(0, 0, W, H);
            // board edge highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(0, 0, W, 3);
            ctx.fillRect(0, 0, 3, H);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(W-3, 0, 3, H);
            ctx.fillRect(0, H-3, W, 3);
            var disc = [
                [0,1,0,1,0,1,0],
                [1,0,1,0,1,0,0],
                [0,1,2,1,2,0,0],
                [1,0,1,2,1,0,0],
                [0,1,0,0,2,0,0],
                [1,2,2,1,2,1,2],
            ];
            var winCells = [[3,3],[3,4],[3,5],[3,6]];
            function isWin(r, c) {
                return winCells.some(function(w){ return w[0]===r && w[1]===c; });
            }
            for (var r = 0; r < 6; r++) {
                for (var c = 0; c < 7; c++) {
                    var cx2 = 15+c*29, cy2 = 15+r*29;
                    var v = disc[r][c];
                    var win = isWin(r, c);
                    if (v === 0) {
                        // empty hole — dark inset with inner shadow
                        var holeG = ctx.createRadialGradient(cx2+12, cy2+12, 0, cx2+10, cy2+10, 13);
                        holeG.addColorStop(0, '#070d1f');
                        holeG.addColorStop(0.6, '#0a1535');
                        holeG.addColorStop(1, '#0d2266');
                        ctx.fillStyle = holeG;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                    } else if (v === 1) {
                        // red disc
                        var rg = ctx.createRadialGradient(cx2+5, cy2+4, 1, cx2+10, cy2+10, 13);
                        rg.addColorStop(0, '#ffcdd2');
                        rg.addColorStop(0.35, '#ef5350');
                        rg.addColorStop(1, '#7f0000');
                        ctx.fillStyle = rg;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                        if (win) {
                            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
                            ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 13, 0, Math.PI*2); ctx.stroke();
                            var wg = ctx.createRadialGradient(cx2+10, cy2+10, 8, cx2+10, cy2+10, 18);
                            wg.addColorStop(0, 'rgba(255,255,255,0.3)');
                            wg.addColorStop(1, 'rgba(255,255,255,0)');
                            ctx.fillStyle = wg;
                            ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 18, 0, Math.PI*2); ctx.fill();
                        }
                    } else {
                        // yellow disc
                        var yg = ctx.createRadialGradient(cx2+5, cy2+4, 1, cx2+10, cy2+10, 13);
                        yg.addColorStop(0, '#fffde7');
                        yg.addColorStop(0.35, '#ffd740');
                        yg.addColorStop(1, '#e65100');
                        ctx.fillStyle = yg;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
            // win glow line connecting winning discs
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(15+3*29+10, 15+3*29+10);
            ctx.lineTo(15+6*29+10, 15+3*29+10);
            ctx.stroke();
        };

    (window.__thumbs = window.__thumbs || {})['connectfour'] = draw;
}());

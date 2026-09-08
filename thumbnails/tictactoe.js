/* Miniatura de tictactoe para el catálogo. La carga thumbnails.js bajo demanda,
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
            // deep blue gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0d1547');
            bgG.addColorStop(1, '#1a237e');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle grid texture dots
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (var gi = 0; gi < 11; gi++) {
                for (var gj = 0; gj < 11; gj++) {
                    ctx.fillRect(gi*22+1, gj*22+1, 1, 1);
                }
            }
            // grid lines with glow
            ctx.lineCap = 'round';
            [73, 147].forEach(function(p) {
                // glow layer
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.moveTo(p, 15); ctx.lineTo(p, 205); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(15, p); ctx.lineTo(205, p); ctx.stroke();
                // crisp line
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(p, 15); ctx.lineTo(p, 205); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(15, p); ctx.lineTo(205, p); ctx.stroke();
            });
            // board pieces
            var board2 = [['X','O','X'],['O','X','O'],['O','','X']];
            board2.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var pcx = 15+c*73+36, pcy = 15+r*73+36;
                    if (v === 'X') {
                        // red glow
                        ctx.strokeStyle = 'rgba(239,83,80,0.25)'; ctx.lineWidth = 14;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                        // crisp X
                        ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                        // bright highlight
                        ctx.strokeStyle = 'rgba(255,180,180,0.5)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                    } else if (v === 'O') {
                        // blue glow
                        ctx.strokeStyle = 'rgba(66,165,245,0.25)'; ctx.lineWidth = 14;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                        // crisp O
                        ctx.strokeStyle = '#42a5f5'; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                        // highlight arc
                        ctx.strokeStyle = 'rgba(180,230,255,0.5)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                    }
                });
            });
            // winning diagonal line — golden with glow
            ctx.strokeStyle = 'rgba(255,238,88,0.3)'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(51, 51); ctx.lineTo(183, 183); ctx.stroke();
            ctx.strokeStyle = '#ffee58'; ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]);
            ctx.beginPath(); ctx.moveTo(51, 51); ctx.lineTo(183, 183); ctx.stroke();
            ctx.setLineDash([]);
        };

    (window.__thumbs = window.__thumbs || {})['tictactoe'] = draw;
}());

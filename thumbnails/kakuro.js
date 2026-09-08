/* Miniatura de kakuro para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#16203a'); bg.addColorStop(1, '#080d18');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 5, m = W * 0.78, s = m / n, ox = (W - m) / 2, oy = (H - m) / 2 - 4;
            var pat = [
                [0,0,0,0,0],
                [0,1,1,1,0],
                [0,1,1,1,1],
                [0,1,1,1,1],
                [0,0,1,1,1]
            ];
            var num = [[0,0,0,0,0],[0,3,0,7,0],[0,0,9,0,4],[0,5,0,0,0],[0,0,0,8,0]];
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var x = ox + c * s, y = oy + r * s;
                    if (pat[r][c]) {
                        ctx.fillStyle = '#e9eef7';
                        ctx.fillRect(x, y, s, s);
                        ctx.strokeStyle = '#7f8ea6'; ctx.lineWidth = 1;
                        ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                        if (num[r][c]) {
                            ctx.fillStyle = '#16203a';
                            ctx.font = 'bold ' + Math.round(s * 0.5) + 'px Arial';
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText(num[r][c], x + s / 2, y + s / 2 + 1);
                        }
                    } else {
                        ctx.fillStyle = '#1b2436';
                        ctx.fillRect(x, y, s, s);
                        ctx.strokeStyle = '#334259'; ctx.lineWidth = 1;
                        ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
                        var right = (r === 1 && c === 0) ? 16 : (r === 2 && c === 0) ? 21 : 0;
                        var down = (r === 0 && c === 1) ? 17 : (r === 0 && c === 2) ? 23 : 0;
                        if (right || down) {
                            ctx.strokeStyle = '#4a5b76';
                            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.stroke();
                            ctx.font = 'bold ' + Math.round(s * 0.33) + 'px Arial';
                            if (right) {
                                ctx.fillStyle = '#ffd54a'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                                ctx.fillText(right, x + s - 3, y + s * 0.27);
                            }
                            if (down) {
                                ctx.fillStyle = '#8fd3f4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                                ctx.fillText(down, x + 3, y + s * 0.74);
                            }
                        }
                    }
                }
            }
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('KAKURO', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['kakuro'] = draw;
}());

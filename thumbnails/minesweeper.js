/* Miniatura de minesweeper para el catálogo. La carga thumbnails.js bajo demanda,
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
            // silver background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#d8d8d8');
            bgG.addColorStop(1, '#b0b0b0');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var cell = 22, ox = 10, oy = 10;
            var board = [
                [0, 1, 0, 0, 0, 1, 0, 0, 0],
                [1, 2, 1, 0, 1, 2, 1, 0, 0],
                [0, 1, 0, 0, 0, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 0, 1,-1, 1, 0, 0, 1, 1],
                [0, 0, 0, 1, 1, 0, 0, 1,-2],
                [0, 0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
            ];
            var numCols = ['','#1565c0','#2e7d32','#c62828','#4a148c','#880e4f','#006064','#212121','#546e7a'];
            board.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var x = ox+c*cell, y = oy+r*cell;
                    if (v === -2) {
                        // unrevealed — 3D bevel effect
                        var cellG = ctx.createLinearGradient(x, y, x+cell, y+cell);
                        cellG.addColorStop(0, '#d0d0d0');
                        cellG.addColorStop(1, '#a8a8a8');
                        ctx.fillStyle = cellG;
                        ctx.fillRect(x, y, cell-1, cell-1);
                        // top-left highlight bevel
                        ctx.fillStyle = 'rgba(255,255,255,0.8)';
                        ctx.fillRect(x, y, cell-1, 2);
                        ctx.fillRect(x, y, 2, cell-1);
                        // bottom-right shadow bevel
                        ctx.fillStyle = 'rgba(0,0,0,0.35)';
                        ctx.fillRect(x+cell-2, y, 1, cell-1);
                        ctx.fillRect(x, y+cell-2, cell-1, 1);
                    } else if (v === -1) {
                        // exploded mine — red cell
                        ctx.fillStyle = '#ef5350';
                        ctx.fillRect(x, y, cell-1, cell-1);
                        // mine body
                        var mineG = ctx.createRadialGradient(x+cell/2-1, y+cell/2-2, 0, x+cell/2, y+cell/2, 7);
                        mineG.addColorStop(0, '#555');
                        mineG.addColorStop(1, '#111');
                        ctx.fillStyle = mineG;
                        ctx.beginPath(); ctx.arc(x+cell/2, y+cell/2, 6, 0, Math.PI*2); ctx.fill();
                        // mine highlight
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.beginPath(); ctx.arc(x+cell/2-2, y+cell/2-2, 2, 0, Math.PI*2); ctx.fill();
                        // spikes
                        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
                        for (var si = 0; si < 8; si++) {
                            var sa = si * Math.PI/4;
                            ctx.beginPath(); ctx.moveTo(x+cell/2, y+cell/2);
                            ctx.lineTo(x+cell/2+Math.cos(sa)*9, y+cell/2+Math.sin(sa)*9);
                            ctx.stroke();
                        }
                    } else {
                        // revealed cell — flat with inner shadow top/left
                        ctx.fillStyle = '#cacaca';
                        ctx.fillRect(x, y, cell-1, cell-1);
                        ctx.fillStyle = 'rgba(0,0,0,0.12)';
                        ctx.fillRect(x, y, cell-1, 1);
                        ctx.fillRect(x, y, 1, cell-1);
                        if (v > 0) {
                            ctx.fillStyle = numCols[v];
                            ctx.font = 'bold 12px sans-serif';
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText(v, x+cell/2, y+cell/2);
                        }
                    }
                });
            });
            // flag cell
            var fx = ox+7*cell, fy = oy+4*cell;
            var flagCellG = ctx.createLinearGradient(fx, fy, fx+cell, fy+cell);
            flagCellG.addColorStop(0, '#d0d0d0');
            flagCellG.addColorStop(1, '#a8a8a8');
            ctx.fillStyle = flagCellG;
            ctx.fillRect(fx, fy, cell-1, cell-1);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(fx, fy, cell-1, 2); ctx.fillRect(fx, fy, 2, cell-1);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(fx+cell-2, fy, 1, cell-1); ctx.fillRect(fx, fy+cell-2, cell-1, 1);
            // flag shape
            var flagG = ctx.createLinearGradient(fx+7, fy+4, fx+18, fy+12);
            flagG.addColorStop(0, '#ff5252');
            flagG.addColorStop(1, '#b71c1c');
            ctx.fillStyle = flagG;
            ctx.beginPath(); ctx.moveTo(fx+7, fy+4); ctx.lineTo(fx+18, fy+8); ctx.lineTo(fx+7, fy+12); ctx.fill();
            ctx.fillStyle = '#222';
            ctx.fillRect(fx+6, fy+4, 2, 14);
            ctx.fillRect(fx+2, fy+18, 12, 2);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['minesweeper'] = draw;
}());

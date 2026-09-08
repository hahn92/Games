/* Miniatura de sokoban para el catálogo. La carga thumbnails.js bajo demanda,
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
            // Background gradient
            var g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, '#0d1f2d');
            g.addColorStop(1, '#1a3a50');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);

            var TILE = 28;
            var level = [
                [1,1,1,1,1,1,1],
                [1,0,0,3,0,2,1],
                [1,0,5,0,3,2,1],
                [1,0,0,0,4,0,1],
                [1,1,1,1,1,1,1]
            ];
            var rows = level.length, cols = level[0].length;
            var ox = Math.floor((W - cols * TILE) / 2);
            var oy = Math.floor((H - rows * TILE) / 2);

            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    var tx = ox + c * TILE, ty = oy + r * TILE;
                    var cell = level[r][c];

                    if (cell === 1) {
                        // wall
                        ctx.fillStyle = '#2c3e50';
                        ctx.fillRect(tx, ty, TILE, TILE);
                        ctx.fillStyle = '#3d5166';
                        ctx.fillRect(tx, ty, TILE, 3);
                        ctx.fillRect(tx, ty, 3, TILE);
                        ctx.fillStyle = '#1a2535';
                        ctx.fillRect(tx, ty + TILE - 3, TILE, 3);
                    } else {
                        // floor
                        ctx.fillStyle = '#1a2e3a';
                        ctx.fillRect(tx, ty, TILE, TILE);

                        if (cell === 2) {
                            // target
                            ctx.strokeStyle = '#ff7043';
                            ctx.lineWidth = 2;
                            ctx.beginPath(); ctx.arc(tx + TILE/2, ty + TILE/2, 7, 0, Math.PI*2); ctx.stroke();
                            ctx.strokeStyle = 'rgba(255,112,67,0.4)';
                            ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.arc(tx + TILE/2, ty + TILE/2, 3.5, 0, Math.PI*2); ctx.stroke();
                        } else if (cell === 3) {
                            // box
                            ctx.fillStyle = '#8d6534';
                            ctx.fillRect(tx+4, ty+4, TILE-8, TILE-8);
                            ctx.fillStyle = '#c4923e';
                            ctx.fillRect(tx+4, ty+4, TILE-8, 3);
                            ctx.fillRect(tx+4, ty+4, 3, TILE-8);
                            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(tx+7, ty+7); ctx.lineTo(tx+TILE-7, ty+TILE-7);
                            ctx.moveTo(tx+TILE-7, ty+7); ctx.lineTo(tx+7, ty+TILE-7);
                            ctx.stroke();
                        } else if (cell === 4) {
                            // box on target
                            ctx.fillStyle = '#2e7d32';
                            ctx.fillRect(tx+4, ty+4, TILE-8, TILE-8);
                            ctx.fillStyle = '#43a047';
                            ctx.fillRect(tx+4, ty+4, TILE-8, 3);
                            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(tx+9, ty+14); ctx.lineTo(tx+13, ty+18); ctx.lineTo(tx+20, ty+10);
                            ctx.stroke();
                        } else if (cell === 5) {
                            // player — body + head
                            ctx.fillStyle = '#1565c0';
                            ctx.beginPath(); ctx.arc(tx + TILE/2, ty + TILE/2 + 3, 7, 0, Math.PI*2); ctx.fill();
                            ctx.fillStyle = '#ffcc80';
                            ctx.beginPath(); ctx.arc(tx + TILE/2, ty + TILE/2 - 5, 5, 0, Math.PI*2); ctx.fill();
                        }
                    }
                }
            }

            // Title bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, W, 28);
            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EMPUJA CAJAS', W/2, 14);

            // bottom bar
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, H - 28, W, 28);
            ctx.fillStyle = '#ff7043';
            ctx.font = '12px monospace';
            ctx.fillText('10 NIVELES · SOKOBAN', W/2, H - 14);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['sokoban'] = draw;
}());

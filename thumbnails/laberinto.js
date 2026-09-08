/* Miniatura de laberinto para el catálogo. La carga thumbnails.js bajo demanda,
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
            // dark background
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#05050f');
            bgG.addColorStop(1, '#0a0a1a');
            ctx.fillStyle = bgG;
            ctx.fillRect(0, 0, W, H);

            // draw a representative 7x7 maze slice (static, no random)
            var cell = 26;
            var ox = 14, oy = 34;
            // walls encoded as bitmask: t=1, r=2, b=4, l=8
            // A hand-crafted maze pattern for the thumbnail
            var maze = [
                [0b1010, 0b1010, 0b1011, 0b1010, 0b1011, 0b1010, 0b1011],
                [0b1100, 0b0001, 0b1100, 0b0001, 0b1100, 0b0101, 0b1100],
                [0b1010, 0b1110, 0b1001, 0b1110, 0b1001, 0b1010, 0b0011],
                [0b1100, 0b0011, 0b1110, 0b0011, 0b1110, 0b0101, 0b1100],
                [0b1010, 0b1100, 0b0011, 0b1100, 0b0011, 0b1010, 0b0011],
                [0b1110, 0b0001, 0b1100, 0b0101, 0b1100, 0b0111, 0b1100],
                [0b1010, 0b1110, 0b0001, 0b1010, 0b0001, 0b1010, 0b0111]
            ];
            var COLS = 7, ROWS = 7;

            // cell fill
            ctx.fillStyle = '#090918';
            ctx.fillRect(ox, oy, COLS * cell, ROWS * cell);

            // neon walls
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var r = 0; r < ROWS; r++) {
                for (var c = 0; c < COLS; c++) {
                    var m = maze[r][c];
                    var x = ox + c * cell, y = oy + r * cell;
                    if (m & 1) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }            // top
                    if (m & 2) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); } // right
                    if (m & 4) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); } // bottom
                    if (m & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }            // left
                }
            }
            ctx.stroke();

            // outer border
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(ox, oy, COLS * cell, ROWS * cell);

            // trail highlight (cells visited)
            var trailCells = [[0,0],[1,0],[1,1],[1,2],[2,2],[3,2],[3,3],[4,3],[5,3],[5,4],[5,5],[6,5],[6,6]];
            ctx.fillStyle = 'rgba(0,229,255,0.18)';
            for (var ti = 0; ti < trailCells.length - 1; ti++) {
                ctx.fillRect(ox + trailCells[ti][0] * cell + 3,
                             oy + trailCells[ti][1] * cell + 3,
                             cell - 6, cell - 6);
            }

            // start marker (green square top-left)
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(ox + 4, oy + 4, cell - 8, cell - 8);

            // exit marker (orange bottom-right)
            ctx.fillStyle = '#ff512f';
            ctx.fillRect(ox + 6 * cell + 4, oy + 6 * cell + 4, cell - 8, cell - 8);

            // player dot following trail
            var last = trailCells[trailCells.length - 1];
            var px = ox + last[0] * cell + cell / 2;
            var py = oy + last[1] * cell + cell / 2;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();

            // dim grid lines under maze for depth
            ctx.strokeStyle = 'rgba(0,96,112,0.12)';
            ctx.lineWidth = 1;
            for (var gi = 0; gi <= COLS; gi++) {
                ctx.beginPath();
                ctx.moveTo(ox + gi * cell, oy);
                ctx.lineTo(ox + gi * cell, oy + ROWS * cell);
                ctx.stroke();
            }
            for (var gj = 0; gj <= ROWS; gj++) {
                ctx.beginPath();
                ctx.moveTo(ox, oy + gj * cell);
                ctx.lineTo(ox + COLS * cell, oy + gj * cell);
                ctx.stroke();
            }

            // scan-line overlay for CRT feel
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (var sl = oy; sl < oy + ROWS * cell; sl += 4) {
                ctx.fillRect(ox, sl, COLS * cell, 1);
            }

            // title bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, W, 28);
            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('LABERINTO NEON', W / 2, 14);

            // level indicator bottom
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, H - 28, W, 28);
            ctx.fillStyle = '#4a8fa8';
            ctx.font = '12px monospace';
            ctx.fillText('10 NIVELES · DFS · TIMER', W / 2, H - 14);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['laberinto'] = draw;
}());

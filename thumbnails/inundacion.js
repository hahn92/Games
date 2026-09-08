/* Miniatura de inundacion para el catálogo. La carga thumbnails.js bajo demanda,
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
            ctx.fillStyle = '#0d1524'; ctx.fillRect(0, 0, W, H);
            var COL = ['#e94f4f', '#4fc3f7', '#ffd54a', '#66bb6a', '#ab63e0', '#ff8a3d'];
            var n = 9, m = W * 0.86, s = m / n, ox = (W - m) / 2, oy = 14;
            /* La mancha crece desde la esquina: se pinta un bloque de un color y
             * el resto salpicado, que es lo que cuenta el juego de un vistazo. */
            var blob = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[3,0],[2,2],[3,1],[4,0]];
            var seed = 7;
            function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var mine = false;
                    for (var b = 0; b < blob.length; b++) if (blob[b][0] === r && blob[b][1] === c) mine = true;
                    ctx.fillStyle = mine ? COL[4] : COL[Math.floor(rnd() * 6)];
                    ctx.fillRect(ox + c * s, oy + r * s, s + 0.5, s + 0.5);
                }
            }
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.beginPath();
            for (var k = 0; k < blob.length; k++) {
                var rr = blob[k][0], cc = blob[k][1];
                function has(a, b2) { for (var i = 0; i < blob.length; i++) if (blob[i][0] === a && blob[i][1] === b2) return true; return false; }
                var x = ox + cc * s, y = oy + rr * s;
                if (!has(rr - 1, cc)) { ctx.moveTo(x, y); ctx.lineTo(x + s, y); }
                if (!has(rr + 1, cc)) { ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s); }
                if (!has(rr, cc - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + s); }
                if (!has(rr, cc + 1)) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); }
            }
            ctx.stroke();
            for (var p = 0; p < 6; p++) {
                ctx.fillStyle = COL[p];
                ctx.beginPath();
                ctx.roundRect(ox + p * (m / 6) + 4, H - 30, m / 6 - 8, 20, 5);
                ctx.fill();
            }
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.fillText('INUNDACIÓN', W / 2, H - 36);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['inundacion'] = draw;
}());

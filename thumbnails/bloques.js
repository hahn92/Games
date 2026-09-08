/* Miniatura de bloques para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#151f36'); bg.addColorStop(1, '#070c16');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 9, m = W * 0.74, s = m / n, ox = (W - m) / 2, oy = 14;
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var box = (((r / 3) | 0) + ((c / 3) | 0)) % 2;
                    ctx.fillStyle = box ? 'rgba(143,211,244,0.07)' : 'rgba(143,211,244,0.03)';
                    ctx.fillRect(ox + c * s, oy + r * s, s, s);
                }
            }
            function cell(x, y, sz, col, alpha) {
                ctx.globalAlpha = alpha == null ? 1 : alpha;
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.roundRect(x + 1, y + 1, sz - 2, sz - 2, Math.max(2, sz * 0.16)); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(x + 2, y + 2, sz - 4, Math.max(1, sz * 0.16));
                ctx.globalAlpha = 1;
            }
            var filled = [[0,0,'#4fc3f7'],[0,1,'#4fc3f7'],[1,0,'#4fc3f7'],[1,1,'#4fc3f7'],
                          [3,3,'#66bb6a'],[3,4,'#66bb6a'],[3,5,'#66bb6a'],[4,4,'#66bb6a'],
                          [6,0,'#ffd54a'],[6,1,'#ffd54a'],[6,2,'#ffd54a'],[7,0,'#ab63e0'],
                          [8,6,'#ff8a3d'],[8,7,'#ff8a3d'],[8,8,'#ff8a3d'],[2,7,'#e94f4f'],[3,7,'#e94f4f']];
            filled.forEach(function (f) { cell(ox + f[1] * s, oy + f[0] * s, s, f[2]); });
            // fila a punto de limpiarse, en fantasma
            for (var c2 = 0; c2 < n; c2++) cell(ox + c2 * s, oy + 5 * s, s, '#26c6da', 0.5);
            ctx.strokeStyle = 'rgba(143,211,244,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (var k = 0; k <= 3; k++) {
                ctx.moveTo(ox + k * s * 3, oy); ctx.lineTo(ox + k * s * 3, oy + m);
                ctx.moveTo(ox, oy + k * s * 3); ctx.lineTo(ox + m, oy + k * s * 3);
            }
            ctx.stroke();
            var ty = oy + m + 12, ps = 13;
            [[0,0],[0,1],[1,0]].forEach(function (p) { cell(28 + p[1] * ps, ty + p[0] * ps, ps, '#ab63e0'); });
            [[0,0],[0,1],[0,2]].forEach(function (p) { cell(W / 2 - 20 + p[1] * ps, ty + p[0] * ps, ps, '#ffd54a'); });
            [[0,0],[1,0]].forEach(function (p) { cell(W - 48 + p[1] * ps, ty + p[0] * ps, ps, '#4fc3f7'); });
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.fillText('BLOQUES', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['bloques'] = draw;
}());

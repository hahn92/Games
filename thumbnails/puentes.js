/* Miniatura de puentes para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#12283f'); bg.addColorStop(1, '#060d16');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 5, m = W * 0.78, s = m / n, ox = (W - m) / 2, oy = (H - m) / 2 - 6;
            function P(r, c) { return { x: ox + c * s + s / 2, y: oy + r * s + s / 2 }; }
            var isl = [[0,0,3],[0,2,4],[0,4,2],[2,0,2],[2,2,4],[2,4,3],[4,0,2],[4,2,3],[4,4,2]];
            /* Puentes simples y dobles, que es lo que hay que distinguir. */
            var links = [[0,1,2],[1,2,1],[0,3,2],[1,4,2],[2,5,1],[3,4,1],[4,5,1],[3,6,1],[4,7,2],[5,8,1],[6,7,1],[7,8,1]];
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 3;
            links.forEach(function (l) {
                var A = P(isl[l[0]][0], isl[l[0]][1]), B = P(isl[l[1]][0], isl[l[1]][1]);
                var horiz = isl[l[0]][0] === isl[l[1]][0];
                var off = l[2] === 2 ? 4 : 0;
                ctx.beginPath();
                if (horiz) {
                    ctx.moveTo(A.x, A.y - off); ctx.lineTo(B.x, B.y - off);
                    if (off) { ctx.moveTo(A.x, A.y + off); ctx.lineTo(B.x, B.y + off); }
                } else {
                    ctx.moveTo(A.x - off, A.y); ctx.lineTo(B.x - off, B.y);
                    if (off) { ctx.moveTo(A.x + off, A.y); ctx.lineTo(B.x + off, B.y); }
                }
                ctx.stroke();
            });
            isl.forEach(function (o) {
                var p = P(o[0], o[1]);
                ctx.fillStyle = '#1f6b46';
                ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.3, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#48d18a'; ctx.lineWidth = 2; ctx.stroke();
                ctx.fillStyle = '#f2f7ff';
                ctx.font = 'bold ' + Math.round(s * 0.34) + 'px Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(o[2], p.x, p.y + 1);
            });
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 12px monospace';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('PUENTES', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['puentes'] = draw;
}());

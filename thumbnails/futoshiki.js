/* Miniatura de futoshiki para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#1b1f30'); bg.addColorStop(1, '#0e1120');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 4, gap = 18, pad = 24;
            var cs = Math.floor((W - pad * 2 - gap * (n - 1)) / n);
            function cl(c) { return pad + c * (cs + gap); }
            function ct(r) { return pad + 6 + r * (cs + gap); }
            var vals = [3,0,0,1, 0,4,0,0, 0,0,2,0, 1,0,0,4];
            var given = [1,0,0,1, 0,1,0,0, 0,0,1,0, 1,0,0,1];
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var i = r * n + c;
                    ctx.fillStyle = given[i] ? '#232a42' : '#1a1f33';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(cl(c), ct(r), cs, cs, 8);
                    else ctx.rect(cl(c), ct(r), cs, cs);
                    ctx.fill();
                    ctx.strokeStyle = '#39415c'; ctx.lineWidth = 1; ctx.stroke();
                    if (!vals[i]) continue;
                    ctx.fillStyle = '#8fd3f4';
                    ctx.font = 'bold ' + Math.floor(cs * 0.55) + 'px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(String(vals[i]), cl(c) + cs / 2, ct(r) + cs * 0.71);
                }
            }
            /* signos: la punta al menor */
            ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            var arm = 6;
            ctx.beginPath();
            var hs = [[0,0,-1],[1,1,1],[2,2,-1],[3,0,1]];
            for (var k = 0; k < hs.length; k++) {
                var mx = cl(hs[k][1]) + cs + gap / 2, my = ct(hs[k][0]) + cs / 2, d = hs[k][2];
                ctx.moveTo(mx - arm * d * 0.6, my - arm);
                ctx.lineTo(mx + arm * d * 0.6, my);
                ctx.lineTo(mx - arm * d * 0.6, my + arm);
            }
            var vsg = [[0,1,-1],[1,3,1],[2,0,1]];
            for (var j = 0; j < vsg.length; j++) {
                var vx = cl(vsg[j][1]) + cs / 2, vy = ct(vsg[j][0]) + cs + gap / 2, d2 = vsg[j][2];
                ctx.moveTo(vx - arm, vy - arm * d2 * 0.6);
                ctx.lineTo(vx, vy + arm * d2 * 0.6);
                ctx.lineTo(vx + arm, vy - arm * d2 * 0.6);
            }
            ctx.stroke();
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('FUTOSHIKI', W / 2, H - 8);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['futoshiki'] = draw;
}());

/* Miniatura de tuberias para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#12212e'); bg.addColorStop(1, '#0a141d');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 5, pad = 16, cs = (W - pad * 2) / n;
            function cx(c) { return pad + c * cs + cs / 2; }
            function cy(r) { return pad + r * cs + cs / 2; }
            ctx.fillStyle = 'rgba(255,255,255,0.035)';
            for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
                ctx.fillRect(pad + c * cs + 2, pad + r * cs + 2, cs - 4, cs - 4);
            }
            /* UP=1 RIGHT=2 DOWN=4 LEFT=8 */
            var m = [ 2,10, 6, 8, 0,
                      4, 0, 5, 2, 12,
                      3,10, 7,10, 9,
                      6, 0, 1, 2, 12,
                      3, 2,10, 3, 9 ];
            var wet = [1,1,1,0,0, 1,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,0,0,0];
            [false, true].forEach(function (isWet) {
                ctx.strokeStyle = isWet ? '#4fc3f7' : '#5a6b7a';
                ctx.lineWidth = cs * 0.2; ctx.lineCap = 'round';
                ctx.beginPath();
                for (var r2 = 0; r2 < n; r2++) for (var c2 = 0; c2 < n; c2++) {
                    if (!!wet[r2 * n + c2] !== isWet) continue;
                    var v = m[r2 * n + c2], h = cs / 2;
                    if (v & 1) { ctx.moveTo(cx(c2), cy(r2)); ctx.lineTo(cx(c2), cy(r2) - h); }
                    if (v & 2) { ctx.moveTo(cx(c2), cy(r2)); ctx.lineTo(cx(c2) + h, cy(r2)); }
                    if (v & 4) { ctx.moveTo(cx(c2), cy(r2)); ctx.lineTo(cx(c2), cy(r2) + h); }
                    if (v & 8) { ctx.moveTo(cx(c2), cy(r2)); ctx.lineTo(cx(c2) - h, cy(r2)); }
                }
                ctx.stroke();
            });
            ctx.fillStyle = '#ffd54a';
            ctx.beginPath(); ctx.arc(cx(2), cy(2), cs * 0.26, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7a5c0d';
            ctx.beginPath(); ctx.arc(cx(2), cy(2), cs * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4fc3f7';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('TUBERÍAS', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['tuberias'] = draw;
}());

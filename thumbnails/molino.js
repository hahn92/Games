/* Miniatura de molino para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#8a5c2e'); bg.addColorStop(1, '#5f3d1c');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var HALF = [W * 0.40, W * 0.27, W * 0.14];
            function pt(i) {
                var r = (i / 8) | 0, p = i % 8, s = HALF[r];
                var dx = (p === 0 || p === 6 || p === 7) ? -s : (p === 2 || p === 3 || p === 4) ? s : 0;
                var dy = (p === 0 || p === 1 || p === 2) ? -s : (p === 4 || p === 5 || p === 6) ? s : 0;
                return { x: W / 2 + dx, y: H / 2 + dy };
            }
            ctx.strokeStyle = '#3a2411'; ctx.lineWidth = 3;
            ctx.beginPath();
            for (var r = 0; r < 3; r++) {
                var a = pt(r * 8), b = pt(r * 8 + 2), c = pt(r * 8 + 4), d = pt(r * 8 + 6);
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
                ctx.lineTo(d.x, d.y); ctx.closePath();
            }
            for (var p = 1; p < 8; p += 2) {
                var o = pt(p), i2 = pt(16 + p);
                ctx.moveTo(o.x, o.y); ctx.lineTo(i2.x, i2.y);
            }
            ctx.stroke();
            ctx.fillStyle = '#3a2411';
            for (var k = 0; k < 24; k++) {
                var q = pt(k);
                ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill();
            }
            /* un molino cerrado en el anillo exterior, resaltado */
            var m0 = pt(0), m2 = pt(2);
            ctx.strokeStyle = 'rgba(255,213,74,0.85)'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m2.x, m2.y); ctx.stroke();

            var rad = 11;
            function piece(i, human) {
                var q = pt(i);
                var g = ctx.createRadialGradient(q.x - rad * 0.3, q.y - rad * 0.35, rad * 0.1, q.x, q.y, rad);
                if (human) { g.addColorStop(0, '#7fdcff'); g.addColorStop(1, '#00728f'); }
                else       { g.addColorStop(0, '#ff9a80'); g.addColorStop(1, '#a32a17'); }
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
            }
            [0, 1, 2, 11, 19].forEach(function (i) { piece(i, true); });
            [4, 6, 9, 13, 21].forEach(function (i) { piece(i, false); });

            ctx.fillStyle = '#ffe9a8';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('MOLINO', W / 2, H - 6);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['molino'] = draw;
}());

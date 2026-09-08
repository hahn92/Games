/* Miniatura de gomoku para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#d9a441'); bg.addColorStop(1, '#c08b32');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 9, pad = 20, st = (W - pad * 2) / (n - 1);
            function px(c) { return pad + c * st; }
            ctx.strokeStyle = 'rgba(60,40,10,0.55)'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (var i = 0; i < n; i++) {
                ctx.moveTo(px(0), px(i) + 0.5); ctx.lineTo(px(n - 1), px(i) + 0.5);
                ctx.moveTo(px(i) + 0.5, px(0)); ctx.lineTo(px(i) + 0.5, px(n - 1));
            }
            ctx.stroke();
            var rad = st * 0.42;
            function stone(r, c, human) {
                var g = ctx.createRadialGradient(px(c) - rad * 0.3, px(r) - rad * 0.35, rad * 0.1,
                                                 px(c), px(r), rad);
                if (human) { g.addColorStop(0, '#7fdcff'); g.addColorStop(1, '#00728f'); }
                else       { g.addColorStop(0, '#ff9a80'); g.addColorStop(1, '#a32a17'); }
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(px(c), px(r), rad, 0, Math.PI * 2); ctx.fill();
            }
            [[4,2],[4,3],[4,4],[4,5]].forEach(function (p) { stone(p[0], p[1], true); });
            [[3,3],[5,4],[3,5],[6,2]].forEach(function (p) { stone(p[0], p[1], false); });
            ctx.fillStyle = '#3b2708';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('CINCO EN RAYA', W / 2, H - 8);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['gomoku'] = draw;
}());

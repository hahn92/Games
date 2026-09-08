/* Miniatura de lunar para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#05060f'); bg.addColorStop(1, '#141a33');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            /* estrellas: fillRect, que para 1px va mejor que arc */
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            var st = [[18, 26], [52, 14], [88, 40], [140, 20], [176, 48], [200, 18], [36, 62], [162, 78]];
            for (var i = 0; i < st.length; i++) ctx.fillRect(st[i][0], st[i][1], 2, 2);

            /* relieve */
            var ground = [[0, 178], [30, 166], [58, 184], [86, 156], [120, 156], [148, 178], [180, 162], [220, 176]];
            ctx.beginPath(); ctx.moveTo(0, H);
            for (i = 0; i < ground.length; i++) ctx.lineTo(ground[i][0], ground[i][1]);
            ctx.lineTo(W, H); ctx.closePath();
            ctx.fillStyle = '#2b2f45'; ctx.fill();
            ctx.beginPath(); ctx.moveTo(ground[0][0], ground[0][1]);
            for (i = 1; i < ground.length; i++) ctx.lineTo(ground[i][0], ground[i][1]);
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2; ctx.stroke();

            /* plataforma */
            ctx.fillStyle = '#00e5ff'; ctx.fillRect(86, 153, 34, 5);

            /* módulo */
            ctx.save(); ctx.translate(103, 104);
            ctx.fillStyle = '#d8dee9';
            ctx.beginPath();
            ctx.moveTo(0, -16); ctx.lineTo(14, -6); ctx.lineTo(14, 6);
            ctx.lineTo(0, 16); ctx.lineTo(-14, 6); ctx.lineTo(-14, -6);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#aab4c4'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-13, 6); ctx.lineTo(-18, 20);
            ctx.moveTo(13, 6); ctx.lineTo(18, 20);
            ctx.stroke();
            /* llama del motor */
            ctx.fillStyle = '#ffd54a';
            ctx.beginPath(); ctx.moveTo(-5, 17); ctx.lineTo(5, 17); ctx.lineTo(0, 34); ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('ALUNIZAJE', W / 2, H - 12);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['lunar'] = draw;
}());

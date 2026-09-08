/* Miniatura de typingspeed para el catálogo. La carga thumbnails.js bajo demanda,
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
            // gradient background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0a0a1f');
            bgG.addColorStop(1, '#0f3460');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // panel with drop shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            roundRect(ctx, 16, 32, 192, 162, 14, 'rgba(0,0,0,0.35)');
            // panel face
            var panelG = ctx.createLinearGradient(14, 30, 14, 190);
            panelG.addColorStop(0, 'rgba(45,45,65,0.92)');
            panelG.addColorStop(1, 'rgba(28,28,42,0.92)');
            roundRect(ctx, 14, 30, 192, 162, 12, panelG);
            // panel top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(16, 31, 188, 8);
            // WPM gradient number
            var numG = ctx.createLinearGradient(W/2-40, 50, W/2+40, 95);
            numG.addColorStop(0, '#8fd3f4');
            numG.addColorStop(1, '#ff512f');
            ctx.fillStyle = numG;
            ctx.font = 'bold 56px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillText('82', W/2+2, 87);
            ctx.fillStyle = numG;
            ctx.fillText('82', W/2, 85);
            // label
            ctx.fillStyle = '#777'; ctx.font = '10px sans-serif';
            ctx.fillText('PALABRAS / MIN', W/2, 112);
            // typed word
            ctx.fillStyle = '#eee'; ctx.font = 'bold 22px monospace';
            ctx.fillText('RAPIDO', W/2, 148);
            // cursor blink bar
            ctx.fillStyle = '#8fd3f4';
            ctx.fillRect(134, 136, 2, 20);
            // input underline — gradient
            var ulG = ctx.createLinearGradient(34, 0, 186, 0);
            ulG.addColorStop(0, '#8fd3f4');
            ulG.addColorStop(1, '#ff512f');
            ctx.strokeStyle = ulG; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(34, 162); ctx.lineTo(186, 162); ctx.stroke();
            // timer bar track
            roundRect(ctx, 14, 180, 192, 10, 5, '#1a1a2e');
            // timer bar fill with gradient
            var tg = ctx.createLinearGradient(14, 0, 206, 0);
            tg.addColorStop(0, '#8fd3f4');
            tg.addColorStop(1, '#ff512f');
            roundRect(ctx, 14, 180, 128, 10, 5, tg);
            // timer bar shine
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            roundRect(ctx, 14, 180, 128, 4, 5, 'rgba(255,255,255,0.22)');
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['typingspeed'] = draw;
}());

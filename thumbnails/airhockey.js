/* Miniatura de airhockey para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#0c1024');
            // mesa
            roundRect(ctx, 22, 14, W - 44, H - 28, 14, '#101a3c', '#8fd3f4');
            // línea central y círculo
            ctx.strokeStyle = 'rgba(143,211,244,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(24, H/2); ctx.lineTo(W - 24, H/2); ctx.stroke();
            ctx.beginPath(); ctx.arc(W/2, H/2, 24, 0, Math.PI*2); ctx.stroke();
            // porterías
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(W/2 - 28, 15); ctx.lineTo(W/2 + 28, 15); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W/2 - 28, H - 15); ctx.lineTo(W/2 + 28, H - 15); ctx.stroke();
            // mazo IA (arriba)
            ctx.fillStyle = '#ff512f';
            ctx.beginPath(); ctx.arc(80, 55, 17, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#b33a20';
            ctx.beginPath(); ctx.arc(80, 55, 9, 0, Math.PI*2); ctx.fill();
            // mazo jugador (abajo)
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath(); ctx.arc(135, 168, 17, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#5a98b8';
            ctx.beginPath(); ctx.arc(135, 168, 9, 0, Math.PI*2); ctx.fill();
            // disco con estela
            ctx.fillStyle = 'rgba(255,224,130,0.25)';
            ctx.beginPath(); ctx.arc(118, 122, 10, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(108, 134, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffe082';
            ctx.beginPath(); ctx.arc(128, 110, 11, 0, Math.PI*2); ctx.fill();
            // marcador
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('3 - 2', W/2, 32);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['airhockey'] = draw;
}());

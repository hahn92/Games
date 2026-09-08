/* Miniatura de sopaletras para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#101a30');
            var letters = [
                'GATOSRPM',
                'XEOLUNAC',
                'PERROEQB',
                'QSWKAZTR',
                'LFLORHEI',
                'MNDJUYPS',
                'CIELOVQA',
                'RHTBXGOL'
            ];
            var n = 8, s = (W - 40) / n, ox = 20, oy = 20;
            // resaltado de palabra encontrada (PERRO, fila 2)
            ctx.fillStyle = 'rgba(118,255,3,0.25)';
            roundRect(ctx, ox + 2, oy + 2 * s + 2, s * 5 - 4, s - 4, 8, 'rgba(118,255,3,0.25)');
            // resaltado diagonal en curso
            ctx.strokeStyle = 'rgba(255,224,130,0.8)'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ox + 0.5 * s, oy + 0.5 * s);
            ctx.lineTo(ox + 3.5 * s, oy + 3.5 * s);
            ctx.stroke();
            ctx.lineWidth = 1;
            // letras
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    var ch = letters[r][c];
                    ctx.fillStyle = (r === 2 && c < 5) ? '#76ff03' : '#cfe8ff';
                    ctx.fillText(ch, ox + c * s + s/2, oy + r * s + s/2);
                }
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['sopaletras'] = draw;
}());

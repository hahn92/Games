/* Miniatura de saltador para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#0e1d40');
            bg.addColorStop(1, '#2a4a7a');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            [[20,20],[60,45],[180,30],[200,70],[40,90],[150,15]].forEach(function (p) {
                ctx.fillRect(p[0], p[1], 2, 2);
            });
            // plataformas
            function plat(x, y, color) { roundRect(ctx, x, y, 52, 10, 5, color); }
            plat(20, 190, '#43a047');
            plat(95, 150, '#43a047');
            plat(160, 110, '#8d6e63');   // rompible
            plat(60, 70, '#43a047');
            plat(150, 38, '#42a5f5');    // móvil
            // muelle en una plataforma
            ctx.fillStyle = '#ffe082';
            ctx.fillRect(116, 142, 10, 8);
            // personaje saltando
            var px = 86, py = 122;
            ctx.fillStyle = '#76ff03';
            roundRect(ctx, px - 12, py - 18, 24, 22, 8, '#76ff03');
            // ojos
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(px - 4, py - 10, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + 5, py - 10, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(px - 3, py - 10, 1.6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + 6, py - 10, 1.6, 0, Math.PI*2); ctx.fill();
            // patas
            ctx.fillStyle = '#5cc208';
            ctx.fillRect(px - 9, py + 4, 6, 6);
            ctx.fillRect(px + 3, py + 4, 6, 6);
            // líneas de impulso
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(px - 14, py + 16); ctx.lineTo(px - 14, py + 26); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px + 14, py + 16); ctx.lineTo(px + 14, py + 26); ctx.stroke();
        };

    (window.__thumbs = window.__thumbs || {})['saltador'] = draw;
}());

/* Miniatura de minigolf para el catálogo. La carga thumbnails.js bajo demanda,
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
            ctx.fillStyle = '#4e3018'; ctx.fillRect(0, 0, W, H);
            var g = ctx.createLinearGradient(0, 12, 0, H - 12);
            g.addColorStop(0, '#3f9e4d');
            g.addColorStop(1, '#2c7a39');
            ctx.fillStyle = g; ctx.fillRect(12, 12, W - 24, H - 24);

            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            for (var y = 12; y < H - 12; y += 30) ctx.fillRect(12, y, W - 24, 15);

            // arena
            ctx.fillStyle = '#e8d18a';
            roundRect(ctx, 34, 120, 54, 40, 12, '#e8d18a');
            // obstaculo
            roundRect(ctx, 108, 92, 84, 14, 5, '#a9713d');

            // hoyo con bandera
            ctx.fillStyle = '#12210f';
            ctx.beginPath(); ctx.arc(152, 58, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.strokeStyle = '#e8e8ea'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(152, 56); ctx.lineTo(152, 16); ctx.stroke();
            ctx.fillStyle = '#ff512f';
            ctx.beginPath();
            ctx.moveTo(152, 16); ctx.lineTo(178, 24); ctx.lineTo(152, 32);
            ctx.closePath(); ctx.fill();

            // bola y guia del tiro
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(72, 178); ctx.lineTo(132, 96); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#fddb92'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(72, 178); ctx.lineTo(40, 222); ctx.stroke();

            var bg3 = ctx.createRadialGradient(69, 175, 0.5, 72, 178, 9);
            bg3.addColorStop(0, '#ffffff');
            bg3.addColorStop(0.6, '#e6e9ee');
            bg3.addColorStop(1, '#9aa3b0');
            ctx.fillStyle = bg3;
            ctx.beginPath(); ctx.arc(72, 178, 9, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'rgba(8,20,12,0.8)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('HOYO 3/9   PAR 3   −2', W / 2, 15);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['minigolf'] = draw;
}());

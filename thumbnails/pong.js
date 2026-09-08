/* Miniatura de pong para el catálogo. La carga thumbnails.js bajo demanda,
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
            // deep black background with ambient center glow
            background(ctx, '#000');
            var ambG = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 110);
            ambG.addColorStop(0, 'rgba(60,60,80,0.55)');
            ambG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ambG; ctx.fillRect(0, 0, W, H);
            // scores
            ctx.fillStyle = C.white; ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'right'; ctx.fillText('7', W/2-16, 52);
            ctx.textAlign = 'left';  ctx.fillText('3', W/2+16, 52);
            // centre dashed line
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
            ctx.setLineDash([]);
            // paddle left — gradient white-to-grey + rounded
            var pg1 = ctx.createLinearGradient(14, 60, 26, 130);
            pg1.addColorStop(0, '#ffffff');
            pg1.addColorStop(0.5, '#e0e0e0');
            pg1.addColorStop(1, '#a0a0a0');
            roundRect(ctx, 14, 60, 12, 70, 6, pg1);
            // paddle left highlight
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(16, 63, 3, 20);
            // paddle right — gradient
            var pg2 = ctx.createLinearGradient(W-26, 100, W-14, 170);
            pg2.addColorStop(0, '#ffffff');
            pg2.addColorStop(0.5, '#e0e0e0');
            pg2.addColorStop(1, '#a0a0a0');
            roundRect(ctx, W-26, 100, 12, 70, 6, pg2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(W-24, 103, 3, 20);
            // ball trail (fading copies)
            [[115, 126, 0.12], [122, 123, 0.22], [130, 120, 0.35]].forEach(function(t){
                ctx.fillStyle = 'rgba(255,255,255,' + t[2] + ')';
                ctx.beginPath(); ctx.arc(t[0], t[1], 9, 0, Math.PI*2); ctx.fill();
            });
            // ball
            var bx = 130, by = 120;
            var ballG = ctx.createRadialGradient(bx-3, by-3, 0, bx, by, 9);
            ballG.addColorStop(0, '#ffffff');
            ballG.addColorStop(0.6, '#e8e8e8');
            ballG.addColorStop(1, '#aaaaaa');
            ctx.fillStyle = ballG;
            ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2); ctx.fill();
            // glow halo
            var glowG = ctx.createRadialGradient(bx, by, 4, bx, by, 28);
            glowG.addColorStop(0, 'rgba(255,255,255,0.35)');
            glowG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glowG;
            ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI*2); ctx.fill();
        };

    (window.__thumbs = window.__thumbs || {})['pong'] = draw;
}());

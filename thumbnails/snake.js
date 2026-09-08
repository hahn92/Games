/* Miniatura de snake para el catálogo. La carga thumbnails.js bajo demanda,
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
            // deep dark background with gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#071a0e');
            bgG.addColorStop(1, '#0d2b1a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (var i = 0; i <= W; i += 20) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
            }
            // snake body segments
            var seg = [
                [6,6],[5,6],[4,6],[3,6],[3,7],[3,8],[4,8],[5,8],[5,9],[5,10],
                [5,11],[4,11],[3,11],[2,11]
            ];
            seg.forEach(function (s, i) {
                var x = s[0]*20+1, y = s[1]*20+1, sz = 18, cx2 = x+sz/2, cy2 = y+sz/2;
                // drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath(); ctx.ellipse(cx2+1, cy2+3, sz*0.44, sz*0.28, 0, 0, Math.PI*2); ctx.fill();
                // segment gradient
                var g = ctx.createRadialGradient(cx2-3, cy2-3, 0, cx2, cy2, sz*0.72);
                g.addColorStop(0, i === 0 ? '#b2f2bb' : '#74c484');
                g.addColorStop(0.45, i === 0 ? '#69db7c' : '#2f9e44');
                g.addColorStop(1, i === 0 ? '#2f9e44' : '#145226');
                roundRect(ctx, x, y, sz, sz, 5, g);
                // border outline for volume
                ctx.strokeStyle = i === 0 ? 'rgba(100,255,130,0.5)' : 'rgba(30,120,60,0.4)';
                ctx.lineWidth = 1;
                roundRect(ctx, x, y, sz, sz, 5, null, i === 0 ? 'rgba(100,255,130,0.5)' : 'rgba(30,120,60,0.4)');
                // top highlight
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(x+3, y+3, sz-6, 4);
            });
            // head eye
            var hx = 6*20+1, hy = 6*20+1;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(hx+14, hy+7, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(hx+15, hy+7, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(hx+15.5, hy+6.5, 0.8, 0, Math.PI*2); ctx.fill();
            // apple shadow
            var ax = 9*20+10, ay = 3*20+10;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(ax+1, ay+6, 7, 3.5, 0, 0, Math.PI*2); ctx.fill();
            // apple radial gradient
            var ag = ctx.createRadialGradient(ax-3, ay-3, 0, ax, ay, 10);
            ag.addColorStop(0, '#ff8a80');
            ag.addColorStop(0.45, '#e53935');
            ag.addColorStop(1, '#7f0000');
            ctx.fillStyle = ag;
            ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI*2); ctx.fill();
            // apple highlight
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath(); ctx.ellipse(ax-3, ay-3, 3, 2, -0.5, 0, Math.PI*2); ctx.fill();
            // stem
            ctx.strokeStyle = '#40c057'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax+1, ay-9); ctx.quadraticCurveTo(ax+5, ay-14, ax+4, ay-13); ctx.stroke();
            // leaf
            ctx.fillStyle = '#40c057';
            ctx.beginPath(); ctx.ellipse(ax+5, ay-12, 4, 2, -0.8, 0, Math.PI*2); ctx.fill();
        };

    (window.__thumbs = window.__thumbs || {})['snake'] = draw;
}());

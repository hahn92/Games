/* Miniatura de pacman para el catálogo. La carga thumbnails.js bajo demanda,
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
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#000820'); bgG.addColorStop(1, '#001040');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

            function wall(x, y, w, h) {
                var wg = ctx.createLinearGradient(x, y, x+w, y+h);
                wg.addColorStop(0, '#2a4fa8'); wg.addColorStop(1, '#1a3a8a');
                roundRect(ctx, x, y, w, h, 4, wg);
                ctx.strokeStyle = 'rgba(100,150,255,0.28)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x+4, y+2); ctx.lineTo(x+w-4, y+2); ctx.stroke();
            }
            wall(0,0,W,14); wall(0,H-14,W,14); wall(0,0,14,H); wall(W-14,0,14,H);
            wall(28,28,44,14); wall(148,28,44,14);
            wall(28,80,14,58); wall(178,80,14,58);
            wall(80,54,60,14); wall(80,108,60,14); wall(80,155,60,14);
            wall(28,168,44,14); wall(148,168,44,14);

            // pellets
            ctx.fillStyle = '#e8d870';
            [[55,21],[110,21],[165,21],[21,55],[21,110],[21,165],[199,55],[199,110],[199,165],
             [55,200],[110,200],[165,200],[55,68],[165,68],[55,148],[165,148],[55,118],[165,118]
            ].forEach(function(p){ ctx.beginPath(); ctx.arc(p[0],p[1],2.5,0,Math.PI*2); ctx.fill(); });

            // power pellets
            [[35,35],[185,35],[35,185],[185,185]].forEach(function(p) {
                var pg = ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],10);
                pg.addColorStop(0,'#fff9c4'); pg.addColorStop(0.5,'#ffe566'); pg.addColorStop(1,'rgba(255,200,0,0)');
                ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(p[0],p[1],10,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffe566'; ctx.beginPath(); ctx.arc(p[0],p[1],6,0,Math.PI*2); ctx.fill();
            });

            // Pacman
            var px = 110, py = 118, ma = 0.3;
            var pacG = ctx.createRadialGradient(px-3,py-3,1,px,py,18);
            pacG.addColorStop(0,'#fff176'); pacG.addColorStop(0.4,'#ffd600'); pacG.addColorStop(1,'#f9a825');
            ctx.fillStyle = pacG;
            ctx.beginPath(); ctx.moveTo(px,py); ctx.arc(px,py,18,ma,Math.PI*2-ma); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#000820'; ctx.beginPath(); ctx.arc(px+5,py-8,2.5,0,Math.PI*2); ctx.fill();

            // Ghost (Blinky — red)
            var gx = 80, gy = 84;
            var ghostG = ctx.createLinearGradient(gx-12,gy-18,gx+12,gy+18);
            ghostG.addColorStop(0,'#ff6b6b'); ghostG.addColorStop(0.5,'#e53935'); ghostG.addColorStop(1,'#b71c1c');
            ctx.fillStyle = ghostG;
            ctx.beginPath(); ctx.arc(gx,gy-6,12,Math.PI,0); ctx.lineTo(gx+12,gy+14);
            ctx.quadraticCurveTo(gx+8,gy+10,gx+4,gy+14); ctx.quadraticCurveTo(gx,gy+10,gx-4,gy+14);
            ctx.quadraticCurveTo(gx-8,gy+10,gx-12,gy+14); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(gx-4,gy-6,4,5,0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(gx+4,gy-6,4,5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1565c0';
            ctx.beginPath(); ctx.arc(gx-3,gy-5,2.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+5,gy-5,2.5,0,Math.PI*2); ctx.fill();

            ctx.fillStyle = '#ffe566'; ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            ctx.fillText('1UP  1480', W-14, 16); ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['pacman'] = draw;
}());

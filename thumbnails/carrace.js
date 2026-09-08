/* Miniatura de carrace para el catálogo. La carga thumbnails.js bajo demanda,
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
            var bgG = ctx.createLinearGradient(0,0,0,H);
            bgG.addColorStop(0,'#1b3a1b'); bgG.addColorStop(1,'#0e1e0e');
            ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);
            for (var gi = 0; gi < 14; gi++) {
                ctx.fillStyle = gi%2===0 ? 'rgba(60,110,60,0.25)' : 'rgba(40,80,40,0.15)';
                ctx.fillRect(0, gi*16, W, 16);
            }

            var rx = 52, rw = 116;
            ctx.fillStyle = '#242424'; ctx.fillRect(rx,0,rw,H);
            ctx.fillStyle = '#ffd600'; ctx.fillRect(rx,0,3,H); ctx.fillRect(rx+rw-3,0,3,H);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
            ctx.setLineDash([22,12]);
            ctx.beginPath(); ctx.moveTo(rx+rw/2,0); ctx.lineTo(rx+rw/2,H); ctx.stroke();
            ctx.setLineDash([]);

            function car(cx, cy, b0, b1, rf) {
                var cw=26, ch=50;
                ctx.fillStyle = 'rgba(0,0,0,0.28)';
                ctx.beginPath(); ctx.ellipse(cx,cy+ch/2+4,12,5,0,0,Math.PI*2); ctx.fill();
                var bg = ctx.createLinearGradient(cx-cw/2,0,cx+cw/2,0);
                bg.addColorStop(0,b0); bg.addColorStop(0.5,b1); bg.addColorStop(1,b0);
                roundRect(ctx,cx-cw/2,cy-ch/2,cw,ch,5,bg);
                ctx.fillStyle = rf;
                roundRect(ctx,cx-cw/2+4,cy-ch/2+10,cw-8,ch*0.5,3,rf);
                ctx.fillStyle = 'rgba(160,220,255,0.62)';
                roundRect(ctx,cx-cw/2+5,cy-ch/2+6,cw-10,12,2,'rgba(160,220,255,0.62)');
                roundRect(ctx,cx-cw/2+5,cy+ch/2-16,cw-10,11,2,'rgba(160,220,255,0.4)');
                ctx.fillStyle = '#0a0a0a';
                [[-cw/2-2,-ch/2+4],[cw/2-5,-ch/2+4],[-cw/2-2,ch/2-16],[cw/2-5,ch/2-16]].forEach(function(wp){
                    roundRect(ctx,cx+wp[0],cy+wp[1],7,13,2,'#0a0a0a');
                });
                ctx.fillStyle = '#fffde7';
                ctx.beginPath(); ctx.ellipse(cx-cw/2+5,cy-ch/2+3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx+cw/2-5,cy-ch/2+3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff1744';
                ctx.beginPath(); ctx.ellipse(cx-cw/2+5,cy+ch/2-3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx+cw/2-5,cy+ch/2-3,3,2,0,0,Math.PI*2); ctx.fill();
            }

            car(rx+rw*0.27, 55,  '#1565c0','#1976d2','#0d47a1');
            car(rx+rw*0.73, 100, '#f9a825','#fbc02d','#e65100');
            car(rx+rw*0.27, 12,  '#546e7a','#607d8b','#37474f');
            car(rx+rw*0.5,  175, '#c62828','#e53935','#b71c1c');

            // coins
            [[rx+rw*0.5,130],[rx+rw*0.73,158]].forEach(function(p) {
                var cg2 = ctx.createRadialGradient(p[0]-2,p[1]-2,0,p[0],p[1],7);
                cg2.addColorStop(0,'#fff176'); cg2.addColorStop(0.5,'#ffd600'); cg2.addColorStop(1,'#f57f17');
                ctx.fillStyle = cg2; ctx.beginPath(); ctx.arc(p[0],p[1],7,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff176'; ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('$', p[0], p[1]);
            });

            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5;
            [65,82,100,118,135,152].forEach(function(lx2){
                ctx.beginPath(); ctx.moveTo(lx2,0); ctx.lineTo(lx2,20); ctx.stroke();
            });

            ctx.fillStyle = '#ffd600'; ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            ctx.fillText('LVL 3 · 1240', W-5, 5);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['carrace'] = draw;
}());

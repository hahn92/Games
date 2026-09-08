/* Miniatura de bubbleshooter para el catálogo. La carga thumbnails.js bajo demanda,
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
            bgG.addColorStop(0,'#0a0a1e'); bgG.addColorStop(1,'#121228');
            ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

            var bColors = [
                {l:'#ff5252',b:'#e53935',d:'#b71c1c'},
                {l:'#42a5f5',b:'#1e88e5',d:'#0d47a1'},
                {l:'#66bb6a',b:'#43a047',d:'#1b5e20'},
                {l:'#ffee58',b:'#fdd835',d:'#f57f17'},
                {l:'#ab47bc',b:'#8e24aa',d:'#4a148c'},
                {l:'#ffa726',b:'#fb8c00',d:'#e65100'},
            ];
            function bubble(x, y, r, ci) {
                var c = bColors[ci % 6];
                var bg = ctx.createRadialGradient(x-r*0.35,y-r*0.35,0,x,y,r);
                bg.addColorStop(0,c.l); bg.addColorStop(0.5,c.b); bg.addColorStop(1,c.d);
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.38)';
                ctx.beginPath(); ctx.ellipse(x-r*0.28,y-r*0.3,r*0.28,r*0.2,-0.5,0,Math.PI*2); ctx.fill();
            }
            var R = 18, pattern = [[0,1,2,3,4,5],[3,4,5,0,1,2],[1,2,3,4,5,0],[5,0,1,2,3,4],[2,3,4,5,0,1]];
            for (var row = 0; row < 5; row++) {
                var off = (row%2) ? R : 0;
                for (var col = 0; col < 6; col++) {
                    var bx = off + R + col*R*2, by = 16 + row*R*1.72 + R;
                    if (bx+R < W-2) bubble(bx, by, R-2, pattern[row][col]);
                }
            }
            bubble(110, 138, R-3, 3); // flying bubble

            ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4,7]);
            ctx.beginPath(); ctx.moveTo(110,208); ctx.lineTo(110,152); ctx.stroke();
            ctx.setLineDash([]);

            // cannon
            var cg = ctx.createLinearGradient(102,0,118,0);
            cg.addColorStop(0,'#555'); cg.addColorStop(0.5,'#888'); cg.addColorStop(1,'#444');
            roundRect(ctx, 103, 180, 14, 30, 5, cg);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            roundRect(ctx, 105, 182, 5, 26, 3, 'rgba(255,255,255,0.14)');
            var baseG = ctx.createRadialGradient(110,212,0,110,212,22);
            baseG.addColorStop(0,'#555'); baseG.addColorStop(1,'#222');
            ctx.fillStyle = baseG; ctx.beginPath(); ctx.ellipse(110,214,22,9,0,0,Math.PI*2); ctx.fill();

            bubble(22, 200, R-5, 1);
            ctx.fillStyle = '#666'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('NEXT', 22, 218); ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['bubbleshooter'] = draw;
}());

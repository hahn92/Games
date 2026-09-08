/* Miniatura de platformer para el catálogo. La carga thumbnails.js bajo demanda,
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
            var skyG = ctx.createLinearGradient(0,0,0,H);
            skyG.addColorStop(0,'#1a3a5c'); skyG.addColorStop(0.65,'#2a5f8a'); skyG.addColorStop(1,'#4a8ab5');
            ctx.fillStyle = skyG; ctx.fillRect(0,0,W,H);

            // background mountains
            ctx.fillStyle = 'rgba(26,55,85,0.55)';
            ctx.beginPath(); ctx.moveTo(0,H);
            [0,25,45,65,80,100,120,140,155,175,195,220].forEach(function(x,i){
                ctx.lineTo(x,[140,100,118,90,112,82,100,108,95,118,104,140][i]);
            });
            ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

            function platform(x, y, w, h) {
                var grassG = ctx.createLinearGradient(x,y,x,y+8);
                grassG.addColorStop(0,'#5cba4a'); grassG.addColorStop(1,'#3d8a30');
                ctx.fillStyle = grassG; ctx.fillRect(x,y,w,8);
                var dirtG = ctx.createLinearGradient(x,y+8,x,y+h);
                dirtG.addColorStop(0,'#8b5e3c'); dirtG.addColorStop(1,'#5a3820');
                ctx.fillStyle = dirtG; ctx.fillRect(x,y+8,w,h-8);
                ctx.fillStyle = 'rgba(180,255,100,0.18)'; ctx.fillRect(x+2,y,w-4,3);
            }
            platform(0,185,W,35);
            platform(18,148,66,20);
            platform(118,120,76,20);
            platform(58,90,56,18);
            platform(154,74,56,18);

            // stars (golden 5-pt)
            function star(sx, sy, r) {
                var sg = ctx.createRadialGradient(sx,sy,0,sx,sy,r);
                sg.addColorStop(0,'#fff9c4'); sg.addColorStop(0.5,'#ffd600'); sg.addColorStop(1,'#ff8f00');
                ctx.fillStyle = sg;
                ctx.beginPath();
                for (var si = 0; si < 5; si++) {
                    var a = si*Math.PI*2/5 - Math.PI/2;
                    var ia = a + Math.PI/5;
                    if (si===0) ctx.moveTo(sx+Math.cos(a)*r, sy+Math.sin(a)*r);
                    else ctx.lineTo(sx+Math.cos(a)*r, sy+Math.sin(a)*r);
                    ctx.lineTo(sx+Math.cos(ia)*r*0.42, sy+Math.sin(ia)*r*0.42);
                }
                ctx.closePath(); ctx.fill();
            }
            star(80,78,8); star(132,106,7); star(176,62,8); star(38,134,7); star(166,60,7);

            // enemy (red walker)
            var ex=132, ey=110;
            var eg = ctx.createLinearGradient(ex-10,ey-16,ex+10,ey);
            eg.addColorStop(0,'#ff5252'); eg.addColorStop(1,'#b71c1c');
            roundRect(ctx,ex-10,ey-16,20,16,4,eg);
            ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex-4,ey-10,3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex+4,ey-10,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(ex-3,ey-10,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex+5,ey-10,1.5,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.moveTo(ex-7,ey-14); ctx.lineTo(ex-2,ey-12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex+2,ey-12); ctx.lineTo(ex+7,ey-14); ctx.stroke();
            ctx.fillStyle='#b71c1c'; ctx.fillRect(ex-8,ey,7,8); ctx.fillRect(ex+1,ey,7,8);

            // player hero (teal)
            var hx=42, hy=138;
            var hg = ctx.createLinearGradient(hx-8,hy-20,hx+8,hy);
            hg.addColorStop(0,'#4dd0e1'); hg.addColorStop(1,'#0097a7');
            roundRect(ctx,hx-8,hy-20,16,20,3,hg);
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.ellipse(hx-3,hy-13,2.5,3.5,0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(hx+3,hy-13,2.5,3.5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#000';
            ctx.beginPath(); ctx.arc(hx-3,hy-12,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(hx+3,hy-12,1.5,0,Math.PI*2); ctx.fill();
            var lg = ctx.createLinearGradient(hx-6,hy,hx+6,hy+10);
            lg.addColorStop(0,'#0097a7'); lg.addColorStop(1,'#006064');
            ctx.fillStyle=lg; ctx.fillRect(hx-7,hy,6,10); ctx.fillRect(hx+1,hy,6,10);

            ctx.fillStyle='#fff'; ctx.font='bold 10px monospace';
            ctx.textAlign='left'; ctx.textBaseline='top';
            ctx.fillText('LVL 2  430', 7, 5); ctx.textBaseline='alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['platformer'] = draw;
}());

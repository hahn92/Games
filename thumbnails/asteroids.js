/* Miniatura de asteroids para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#000');
            // deep space nebula hints
            var neb1 = ctx.createRadialGradient(50, 100, 0, 50, 100, 80);
            neb1.addColorStop(0, 'rgba(20,0,60,0.3)');
            neb1.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb1; ctx.fillRect(0, 20, 130, 180);
            var neb2 = ctx.createRadialGradient(180, 60, 0, 180, 60, 60);
            neb2.addColorStop(0, 'rgba(0,20,50,0.25)');
            neb2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb2; ctx.fillRect(120, 0, 100, 120);
            // stars — varied sizes and brightness
            [[10,15,2],[40,8,1],[80,20,1],[120,5,2],[160,18,1],[200,10,2],[25,50,1],
             [70,45,2],[130,38,1],[185,52,1],[50,80,1],[100,90,2],[170,75,1],[15,100,1]].forEach(function(s, i){
                ctx.fillStyle = s[2] === 2 ? 'rgba(255,255,255,0.95)':'rgba(255,255,255,0.5)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // asteroid drawing with gradient fill
            function asteroid(acx, acy, ar, pts, offsets) {
                // gradient fill
                var ag = ctx.createRadialGradient(acx-ar*0.25, acy-ar*0.25, 0, acx, acy, ar);
                ag.addColorStop(0, '#888');
                ag.addColorStop(0.5, '#555');
                ag.addColorStop(1, '#222');
                ctx.fillStyle = ag;
                ctx.beginPath();
                for (var ai = 0; ai < pts; ai++) {
                    var aa = ai*(2*Math.PI/pts);
                    var off = offsets ? offsets[ai % offsets.length] : (0.82 + Math.sin(ai*3.7)*0.18);
                    var arr = ar * off;
                    if (ai === 0) ctx.moveTo(acx+Math.cos(aa)*arr, acy+Math.sin(aa)*arr);
                    else ctx.lineTo(acx+Math.cos(aa)*arr, acy+Math.sin(aa)*arr);
                }
                ctx.closePath(); ctx.fill();
                // outline
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.8;
                ctx.beginPath();
                for (var ai2 = 0; ai2 < pts; ai2++) {
                    var aa2 = ai2*(2*Math.PI/pts);
                    var off2 = offsets ? offsets[ai2 % offsets.length] : (0.82 + Math.sin(ai2*3.7)*0.18);
                    var arr2 = ar * off2;
                    if (ai2 === 0) ctx.moveTo(acx+Math.cos(aa2)*arr2, acy+Math.sin(aa2)*arr2);
                    else ctx.lineTo(acx+Math.cos(aa2)*arr2, acy+Math.sin(aa2)*arr2);
                }
                ctx.closePath(); ctx.stroke();
                // surface highlight
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.beginPath(); ctx.arc(acx-ar*0.2, acy-ar*0.2, ar*0.35, 0, Math.PI*2); ctx.fill();
            }
            asteroid(60, 62, 36, 8, [0.9,0.75,0.85,0.95,0.78,0.88,0.82,0.9]);
            asteroid(172, 82, 22, 7, [0.88,0.78,0.92,0.82,0.88,0.75,0.9]);
            asteroid(132, 167, 17, 6, [0.85,0.92,0.78,0.88,0.82,0.9]);
            asteroid(42, 157, 13, 5, [0.88,0.78,0.9,0.82,0.85]);
            // fragments
            [[186,28,8,5],[202,44,5,4],[178,52,6,5]].forEach(function(f){
                asteroid(f[0], f[1], f[2], f[3]);
            });
            // player ship with glow
            var sx = 110, sy = 120, sa = -Math.PI/2;
            // ship glow
            var shipGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
            shipGlow.addColorStop(0, 'rgba(143,211,244,0.2)');
            shipGlow.addColorStop(1, 'rgba(143,211,244,0)');
            ctx.fillStyle = shipGlow;
            ctx.fillRect(sx-30, sy-30, 60, 60);
            // ship body
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(143,211,244,0.18)';
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa)*22, sy+Math.sin(sa)*22);
            ctx.lineTo(sx+Math.cos(sa+2.4)*16, sy+Math.sin(sa+2.4)*16);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*8, sy+Math.sin(sa+Math.PI)*8);
            ctx.lineTo(sx+Math.cos(sa-2.4)*16, sy+Math.sin(sa-2.4)*16);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // thrust flame
            var thrustG = ctx.createLinearGradient(
                sx+Math.cos(sa+Math.PI)*10, sy+Math.sin(sa+Math.PI)*10,
                sx+Math.cos(sa+Math.PI)*24, sy+Math.sin(sa+Math.PI)*24
            );
            thrustG.addColorStop(0, '#ffe066');
            thrustG.addColorStop(0.5, '#ff6b35');
            thrustG.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.strokeStyle = thrustG; ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa+2.4)*11, sy+Math.sin(sa+2.4)*11);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*22, sy+Math.sin(sa+Math.PI)*22);
            ctx.lineTo(sx+Math.cos(sa-2.4)*11, sy+Math.sin(sa-2.4)*11);
            ctx.stroke();
            // bullet glow
            [[sx,sy-46],[sx,sy-62]].forEach(function(b){
                var bulG = ctx.createRadialGradient(b[0], b[1]-4, 0, b[0], b[1]-4, 6);
                bulG.addColorStop(0, 'rgba(255,255,255,0.5)');
                bulG.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = bulG;
                ctx.fillRect(b[0]-5, b[1]-8, 10, 16);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1]-10); ctx.stroke();
            });
        };

    (window.__thumbs = window.__thumbs || {})['asteroids'] = draw;
}());

/* Miniatura de fruitcatcher para el catálogo. La carga thumbnails.js bajo demanda,
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
            // night sky gradient
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#050d1a');
            bgG.addColorStop(1, '#0d2a4a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // stars
            [[20,15,1],[55,8,2],[95,20,1],[140,10,2],[180,18,1],[10,40,1],[170,50,1]].forEach(function(s){
                ctx.fillStyle = s[2]===2 ? 'rgba(255,255,255,0.8)':'rgba(255,255,255,0.45)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // fruits — each drawn as canvas shapes (no emoji)
            var fruits = [
                {x:30,  y:42,  col:'#ff4444', col2:'#8b0000', stemCol:'#228b22', r:15},
                {x:90,  y:22,  col:'#ffe033', col2:'#b8860b', stemCol:'#228b22', r:13},
                {x:155, y:58,  col:'#66cc44', col2:'#1a6b00', stemCol:'#aa5500', r:14},
                {x:200, y:32,  col:'#ff8c00', col2:'#8b4500', stemCol:'#228b22', r:13},
                {x:65,  y:92,  col:'#ff3399', col2:'#880044', stemCol:'#228b22', r:12},
                {x:130, y:78,  col:'#7744ee', col2:'#2a0088', stemCol:'#aa5500', r:11},
            ];
            fruits.forEach(function(f) {
                // drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(f.x+2, f.y+f.r+2, f.r*0.7, f.r*0.3, 0, 0, Math.PI*2); ctx.fill();
                // fruit body
                var fg = ctx.createRadialGradient(f.x-f.r*0.35, f.y-f.r*0.35, 0, f.x, f.y, f.r);
                fg.addColorStop(0, '#fff');
                fg.addColorStop(0.18, f.col);
                fg.addColorStop(1, f.col2);
                ctx.fillStyle = fg;
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
                // outline
                ctx.strokeStyle = f.col2; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.stroke();
                // shine ellipse
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.beginPath(); ctx.ellipse(f.x-f.r*0.3, f.y-f.r*0.28, f.r*0.38, f.r*0.22, -0.4, 0, Math.PI*2); ctx.fill();
                // stem
                ctx.strokeStyle = f.stemCol; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(f.x+1, f.y-f.r); ctx.quadraticCurveTo(f.x+5, f.y-f.r-5, f.x+4, f.y-f.r-4); ctx.stroke();
                // motion trail
                ctx.strokeStyle = f.col + '55'; ctx.lineWidth = 1.5; ctx.setLineDash([3,4]);
                ctx.beginPath(); ctx.moveTo(f.x, f.y-f.r); ctx.lineTo(f.x, f.y-f.r-14); ctx.stroke();
                ctx.setLineDash([]);
            });
            // bomb with glow
            var bombG = ctx.createRadialGradient(183, 107, 0, 185, 110, 15);
            bombG.addColorStop(0, '#666');
            bombG.addColorStop(0.5, '#333');
            bombG.addColorStop(1, '#111');
            ctx.fillStyle = bombG;
            ctx.beginPath(); ctx.arc(185, 110, 14, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(185, 110, 14, 0, Math.PI*2); ctx.stroke();
            // bomb highlight
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.arc(181, 105, 5, 0, Math.PI*2); ctx.fill();
            // fuse
            ctx.strokeStyle = '#aa8800'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(185, 96); ctx.quadraticCurveTo(189, 90, 185, 85); ctx.stroke();
            // fuse spark
            var sparkG = ctx.createRadialGradient(185, 84, 0, 185, 84, 6);
            sparkG.addColorStop(0, '#fff9c4');
            sparkG.addColorStop(0.4, '#ff6b35');
            sparkG.addColorStop(1, 'rgba(255,80,0,0)');
            ctx.fillStyle = sparkG;
            ctx.beginPath(); ctx.arc(185, 84, 6, 0, Math.PI*2); ctx.fill();
            // basket with gradient
            var bx = 68, by = 172, bw = 84, bh = 32;
            var basketG = ctx.createLinearGradient(bx, by, bx, by+bh);
            basketG.addColorStop(0, '#c8901e');
            basketG.addColorStop(0.5, '#8b6914');
            basketG.addColorStop(1, '#5a4010');
            ctx.fillStyle = basketG;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx+bw, by);
            ctx.lineTo(bx+bw-10, by+bh); ctx.lineTo(bx+10, by+bh);
            ctx.closePath(); ctx.fill();
            // basket outline
            ctx.strokeStyle = '#5a4010'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx+bw, by);
            ctx.lineTo(bx+bw-10, by+bh); ctx.lineTo(bx+10, by+bh);
            ctx.closePath(); ctx.stroke();
            // basket weave lines
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2;
            for (var wi = 0; wi < 5; wi++) {
                ctx.beginPath(); ctx.moveTo(bx+wi*20, by); ctx.lineTo(bx+8+wi*14, by+bh); ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(bx, by+bh*0.45); ctx.lineTo(bx+bw, by+bh*0.45); ctx.stroke();
            // basket top highlight
            ctx.fillStyle = 'rgba(255,220,100,0.2)';
            ctx.fillRect(bx+2, by, bw-4, 7);
            // lives — heart shapes
            [10, 30, 50].forEach(function(hx) {
                var hy = 205;
                var heartG = ctx.createRadialGradient(hx+7, hy+3, 0, hx+8, hy+6, 10);
                heartG.addColorStop(0, '#ff8080');
                heartG.addColorStop(0.5, '#e74c3c');
                heartG.addColorStop(1, '#8b0000');
                ctx.fillStyle = heartG;
                ctx.beginPath();
                ctx.moveTo(hx+8, hy+4);
                ctx.bezierCurveTo(hx+8, hy-1, hx, hy-1, hx, hy+4);
                ctx.bezierCurveTo(hx, hy+11, hx+8, hy+15, hx+8, hy+19);
                ctx.bezierCurveTo(hx+8, hy+15, hx+16, hy+11, hx+16, hy+4);
                ctx.bezierCurveTo(hx+16, hy-1, hx+8, hy-1, hx+8, hy+4);
                ctx.fill();
                // heart highlight
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.ellipse(hx+5, hy+3, 3, 2, -0.5, 0, Math.PI*2); ctx.fill();
            });
            // score
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
            ctx.fillText('850 pts', W-6, 20);
        };

    (window.__thumbs = window.__thumbs || {})['fruitcatcher'] = draw;
}());

/* Miniatura de breakout para el catálogo. La carga thumbnails.js bajo demanda,
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
            // dark gradient background
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#0a0a1a');
            bgG.addColorStop(1, '#0d1b2a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var rows = [
                {base:'#e03131', light:'#ff6b6b', dark:'#7f0000'},
                {base:'#e8590c', light:'#ffa94d', dark:'#7d2d00'},
                {base:'#f59f00', light:'#ffd43b', dark:'#7d5100'},
                {base:'#2f9e44', light:'#8ce99a', dark:'#10401c'},
                {base:'#1971c2', light:'#74c0fc', dark:'#003a8c'},
                {base:'#9c36b5', light:'#da77f2', dark:'#4a0072'},
            ];
            var bw = 33, bh = 14, gap = 2, ox = 4, oy = 16;
            rows.forEach(function (col, r) {
                for (var c = 0; c < 6; c++) {
                    var bx = ox+c*(bw+gap), by = oy+r*(bh+gap);
                    // block face gradient (top lighter, bottom darker)
                    var fg = ctx.createLinearGradient(bx, by, bx, by+bh);
                    fg.addColorStop(0, col.light);
                    fg.addColorStop(0.4, col.base);
                    fg.addColorStop(1, col.dark);
                    roundRect(ctx, bx, by, bw, bh, 3, fg);
                    // top highlight strip
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(bx+2, by+1, bw-4, 3);
                    // right shadow edge
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fillRect(bx+bw-3, by+2, 2, bh-3);
                    // bottom shadow edge
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(bx+2, by+bh-3, bw-4, 2);
                    // top-left corner shine
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.fillRect(bx+2, by+2, 4, 2);
                }
            });
            // ball trail
            [[80,155,5,0.1],[90,148,6,0.2],[100,140,7,0.38]].forEach(function(b){
                ctx.fillStyle = 'rgba(255,255,255,' + b[3] + ')';
                ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, Math.PI*2); ctx.fill();
            });
            // ball
            var bx2 = 110, by2 = 132;
            var ballG = ctx.createRadialGradient(bx2-3, by2-3, 0, bx2, by2, 9);
            ballG.addColorStop(0, '#ffffff');
            ballG.addColorStop(0.6, '#e0e0ff');
            ballG.addColorStop(1, '#8888cc');
            ctx.fillStyle = ballG;
            ctx.beginPath(); ctx.arc(bx2, by2, 9, 0, Math.PI*2); ctx.fill();
            var glowG = ctx.createRadialGradient(bx2, by2, 3, bx2, by2, 22);
            glowG.addColorStop(0, 'rgba(200,200,255,0.4)');
            glowG.addColorStop(1, 'rgba(200,200,255,0)');
            ctx.fillStyle = glowG;
            ctx.beginPath(); ctx.arc(bx2, by2, 22, 0, Math.PI*2); ctx.fill();
            // paddle with gradient
            var padG = ctx.createLinearGradient(68, 196, 148, 208);
            padG.addColorStop(0, '#a5d8ff');
            padG.addColorStop(0.5, '#74c0fc');
            padG.addColorStop(1, '#1c7ed6');
            roundRect(ctx, 68, 196, 80, 12, 6, padG);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(72, 197, 30, 3);
        };

    (window.__thumbs = window.__thumbs || {})['breakout'] = draw;
}());

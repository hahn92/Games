/* Miniatura de slidingpuzzle para el catálogo. La carga thumbnails.js bajo demanda,
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
            // deep purple-blue gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0d1347');
            bgG.addColorStop(1, '#2a0050');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle dot texture
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (var di = 0; di < 10; di++) {
                for (var dj = 0; dj < 10; dj++) {
                    ctx.fillRect(di*22+4, dj*22+4, 2, 2);
                }
            }
            // board shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            roundRect(ctx, 14, 14, 196, 196, 10, 'rgba(0,0,0,0.4)');
            // board background
            roundRect(ctx, 12, 12, 196, 196, 8, 'rgba(10,10,40,0.6)');
            var nums = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15];
            var sz = 44, gap = 4, ox = 14, oy = 14;
            nums.forEach(function(v, i) {
                var x = ox+(i%4)*(sz+gap), y = oy+Math.floor(i/4)*(sz+gap);
                if (v === 0) {
                    // empty slot — recessed
                    var emptyG = ctx.createRadialGradient(x+sz/2, y+sz/2, 0, x+sz/2, y+sz/2, sz/2);
                    emptyG.addColorStop(0, 'rgba(0,0,0,0.5)');
                    emptyG.addColorStop(1, 'rgba(0,0,20,0.2)');
                    roundRect(ctx, x, y, sz, sz, 6, emptyG);
                    // arrow indicator on empty slot
                    ctx.fillStyle = 'rgba(255,220,50,0.5)';
                    ctx.font = '20px sans-serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('15', x+sz/2, y+sz/2);
                    ctx.textBaseline = 'alphabetic';
                    return;
                }
                // tile shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                roundRect(ctx, x+3, y+4, sz, sz, 6, 'rgba(0,0,0,0.4)');
                // tile gradient — diagonal blue-to-purple
                var tg = ctx.createLinearGradient(x, y, x+sz, y+sz);
                tg.addColorStop(0, '#6272c8');
                tg.addColorStop(0.5, '#4f5ebf');
                tg.addColorStop(1, '#7c4dff');
                roundRect(ctx, x, y, sz, sz, 6, tg);
                // top highlight
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(x+3, y+2, sz-6, 7);
                // left highlight
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(x+2, y+3, 5, sz-6);
                // number shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.font = 'bold '+(v<10?20:16)+'px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(v, x+sz/2+1, y+sz/2+1);
                ctx.fillStyle = '#fff';
                ctx.fillText(v, x+sz/2, y+sz/2);
            });
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['slidingpuzzle'] = draw;
}());

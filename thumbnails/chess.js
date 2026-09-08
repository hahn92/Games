/* Miniatura de chess para el catálogo. La carga thumbnails.js bajo demanda,
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
            var sq = W / 8;
            // Board
            for (var r = 0; r < 8; r++) {
                for (var c = 0; c < 8; c++) {
                    ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
                    ctx.fillRect(c * sq, r * sq, sq, sq);
                }
            }
            // Representative mid-game position
            var pos = [
                {r:0,c:0,t:'R',w:false},{r:0,c:4,t:'K',w:false},{r:0,c:7,t:'R',w:false},
                {r:1,c:0,t:'P',w:false},{r:1,c:5,t:'P',w:false},{r:1,c:6,t:'P',w:false},{r:1,c:7,t:'P',w:false},
                {r:2,c:1,t:'N',w:false},{r:2,c:3,t:'Q',w:false},
                {r:3,c:4,t:'P',w:false},
                {r:4,c:3,t:'N',w:true},
                {r:5,c:4,t:'P',w:true},
                {r:6,c:0,t:'P',w:true},{r:6,c:5,t:'P',w:true},{r:6,c:6,t:'P',w:true},{r:6,c:7,t:'P',w:true},
                {r:7,c:0,t:'R',w:true},{r:7,c:2,t:'B',w:true},{r:7,c:4,t:'K',w:true}
            ];
            pos.forEach(function (p) {
                var cx = p.c * sq + sq / 2, cy = p.r * sq + sq / 2, rd = sq * 0.38;
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.beginPath(); ctx.ellipse(cx + 1, cy + rd * 0.72, rd * 0.65, rd * 0.18, 0, 0, Math.PI * 2); ctx.fill();
                var g = ctx.createRadialGradient(cx - rd * 0.3, cy - rd * 0.3, rd * 0.1, cx, cy, rd);
                if (p.w) { g.addColorStop(0,'#fff8ec'); g.addColorStop(0.55,'#f4e4bc'); g.addColorStop(1,'#b08828'); }
                else     { g.addColorStop(0,'#7a3d14'); g.addColorStop(0.55,'#2d1200'); g.addColorStop(1,'#0a0400'); }
                ctx.fillStyle = g; ctx.strokeStyle = p.w ? '#8a6a20' : '#d4a84a'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(cx, cy, rd, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = p.w ? '#4a2800' : '#f0d090';
                ctx.font = 'bold ' + Math.round(rd * 0.95) + 'px serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.t, cx, cy);
            });
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['chess'] = draw;
}());

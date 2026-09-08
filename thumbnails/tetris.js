/* Miniatura de tetris para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#0a0a0f');
            // subtle grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            var bw = 20, bh = 18, ox = 10, oy = 2;
            for (var gi = 0; gi <= 10; gi++) {
                ctx.beginPath(); ctx.moveTo(ox+gi*bw, oy); ctx.lineTo(ox+gi*bw, oy+12*bh); ctx.stroke();
            }
            for (var gr = 0; gr <= 12; gr++) {
                ctx.beginPath(); ctx.moveTo(ox, oy+gr*bh); ctx.lineTo(ox+10*bw, oy+gr*bh); ctx.stroke();
            }
            var colors = [
                {base:'#e64980',light:'#f783ac',dark:'#a61e4d'},
                {base:'#f03e3e',light:'#ff6b6b',dark:'#c92a2a'},
                {base:'#fd7e14',light:'#ffa94d',dark:'#e8590c'},
                {base:'#fab005',light:'#ffd43b',dark:'#e67700'},
                {base:'#82c91e',light:'#a9e34b',dark:'#5c940d'},
                {base:'#12b886',light:'#63e6be',dark:'#087f5b'},
                {base:'#228be6',light:'#74c0fc',dark:'#1864ab'},
                {base:'#7950f2',light:'#b197fc',dark:'#5f3dc4'},
            ];
            var board = [
                [0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,5,5,0,0,0,0],
                [0,0,0,5,5,0,0,0,0,0],
                [0,0,0,0,6,6,6,0,0,0],
                [0,0,0,0,0,6,0,0,0,0],
                [0,0,1,1,1,1,0,0,0,0],
                [0,0,0,2,2,0,0,0,0,0],
                [0,0,2,2,0,0,0,0,0,0],
                [3,3,3,3,3,3,3,3,3,0],
                [4,4,4,4,4,4,4,4,4,4],
                [7,7,7,7,7,7,7,7,7,7],
            ];
            board.forEach(function (row, r) {
                row.forEach(function (v, c) {
                    if (!v) return;
                    var x = ox + c*bw, y = oy + r*bh;
                    var col = colors[v-1];
                    // face gradient (top lighter, bottom darker)
                    var fg = ctx.createLinearGradient(x, y, x, y+bh);
                    fg.addColorStop(0, col.light);
                    fg.addColorStop(0.5, col.base);
                    fg.addColorStop(1, col.dark);
                    ctx.fillStyle = fg;
                    ctx.fillRect(x+1, y+1, bw-2, bh-2);
                    // top highlight strip (3D top face illusion)
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillRect(x+2, y+1, bw-4, 3);
                    // left highlight strip
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(x+1, y+1, 3, bh-2);
                    // right shadow strip
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x+bw-3, y+1, 2, bh-2);
                    // bottom shadow strip
                    ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    ctx.fillRect(x+2, y+bh-3, bw-4, 2);
                    // top-left corner highlight dot
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillRect(x+2, y+2, 3, 3);
                });
            });
        };

    (window.__thumbs = window.__thumbs || {})['tetris'] = draw;
}());

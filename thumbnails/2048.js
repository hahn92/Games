/* Miniatura de 2048 para el catálogo. La carga thumbnails.js bajo demanda,
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
            // beige gradient background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#faf8ef');
            bgG.addColorStop(1, '#f0ece0');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // board with subtle shadow
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            roundRect(ctx, 13, 13, 200, 200, 10, 'rgba(0,0,0,0.12)');
            roundRect(ctx, 10, 10, 200, 200, 8, '#bbada0');
            var tiles = [
                [2,4,8,16],
                [32,64,128,256],
                [512,1024,2048,0],
                [0,0,0,0],
            ];
            var tileColors = {
                2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',
                32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',
                512:'#edc850',1024:'#edc53f',2048:'#edc22e',
            };
            var textColors = {2:'#776e65',4:'#776e65'};
            tiles.forEach(function(row,r){
                row.forEach(function(v,c){
                    if(!v) return;
                    var x = 14+c*48, y = 14+r*48, s = 44;
                    // tile shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    roundRect(ctx, x+2, y+3, s, s, 4, 'rgba(0,0,0,0.18)');
                    // tile face
                    roundRect(ctx, x, y, s, s, 4, tileColors[v]||'#3c3a32');
                    // subtle top highlight for depth
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.fillRect(x+3, y+2, s-6, 6);
                    // text shadow (offset draw)
                    var tCol = textColors[v] || '#f9f6f2';
                    var fSize = v<100?18:v<1000?14:11;
                    ctx.font = 'bold '+fSize+'px Arial';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillText(v, x+s/2+1, y+s/2+1);
                    ctx.fillStyle = tCol;
                    ctx.fillText(v, x+s/2, y+s/2);
                });
            });
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['2048'] = draw;
}());

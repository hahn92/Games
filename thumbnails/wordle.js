/* Miniatura de wordle para el catálogo. La carga thumbnails.js bajo demanda,
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
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#121213');
            bgG.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var grid = [
                ['C','I','E','L','O'],
                ['A','G','U','A','S'],
                ['S','O','L','A','R'],
                ['','','','',''],
                ['','','','',''],
                ['','','','',''],
            ];
            var states = [
                [2,1,0,2,0],
                [0,0,2,1,0],
                [2,2,2,2,2],
            ];
            // state colors: absent, present, correct
            var stateBase = ['#3a3a3c','#b59f3b','#538d4e'];
            var stateLight = ['#555','#d4b850','#6aad5e'];
            var cw = 36, ch = 36, gap = 5, ox = 12, oy = 8;
            grid.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var x = ox+c*(cw+gap), y = oy+r*(ch+gap);
                    if (r < 3) {
                        var si = states[r][c];
                        // tile gradient
                        var tg = ctx.createLinearGradient(x, y, x, y+ch);
                        tg.addColorStop(0, stateLight[si]);
                        tg.addColorStop(1, stateBase[si]);
                        roundRect(ctx, x, y, cw, ch, 4, tg);
                        // tile top highlight
                        ctx.fillStyle = 'rgba(255,255,255,0.12)';
                        ctx.fillRect(x+3, y+2, cw-6, 6);
                        // letter shadow
                        if (v) {
                            ctx.font = 'bold 20px sans-serif';
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillStyle = 'rgba(0,0,0,0.35)';
                            ctx.fillText(v, x+cw/2+1, y+ch/2+1);
                            ctx.fillStyle = '#fff';
                            ctx.fillText(v, x+cw/2, y+ch/2);
                        }
                    } else {
                        // empty tile outline
                        ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 2;
                        roundRect(ctx, x, y, cw, ch, 4, '#121213', '#3a3a3c');
                    }
                });
            });
            // "WORDLE" header
            var hg = ctx.createLinearGradient(ox, 0, ox+5*(cw+gap), 0);
            hg.addColorStop(0, '#8fd3f4');
            hg.addColorStop(1, '#ff512f');
            ctx.fillStyle = hg;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('WORDLE', W/2, H-6);
        };

    (window.__thumbs = window.__thumbs || {})['wordle'] = draw;
}());

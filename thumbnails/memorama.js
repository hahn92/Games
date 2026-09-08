/* Miniatura de memorama para el catálogo. La carga thumbnails.js bajo demanda,
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
            gradBg(ctx, '#0d1b2a', '#16213e');
            var symbols = ['★', '♥', '♦', '♣', '◆', '♠', '♪', '♫'];
            var cols = 4, cw = 48, ch = 48, ox = 10, oy = 10;
            var revealed = [3, 7, 9, 14];
            for (var i = 0; i < 16; i++) {
                var cx2 = ox+(i%cols)*(cw+4), cy2 = oy+Math.floor(i/4)*(ch+4);
                // card drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                roundRect(ctx, cx2+3, cy2+4, cw, ch, 7, 'rgba(0,0,0,0.4)');
                if (revealed.indexOf(i) >= 0) {
                    // face-up card: deep green gradient
                    var rg = ctx.createLinearGradient(cx2, cy2, cx2, cy2+ch);
                    rg.addColorStop(0, '#2d8c5f');
                    rg.addColorStop(1, '#1a5e38');
                    roundRect(ctx, cx2, cy2, cw, ch, 6, rg);
                    // golden border
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 1.5;
                    roundRect(ctx, cx2+1, cy2+1, cw-2, ch-2, 6, null, '#ffd700');
                    // top highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.12)';
                    ctx.fillRect(cx2+4, cy2+3, cw-8, 8);
                    // symbol
                    ctx.fillStyle = '#a3f0c5';
                    ctx.font = 'bold 22px serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,220,100,0.5)';
                    ctx.shadowBlur = 6;
                    ctx.fillText(symbols[i%symbols.length], cx2+cw/2, cy2+ch/2);
                    ctx.shadowBlur = 0;
                } else {
                    // face-down card: blue gradient
                    var bg2 = ctx.createLinearGradient(cx2, cy2, cx2+cw, cy2+ch);
                    bg2.addColorStop(0, '#1c5fa8');
                    bg2.addColorStop(1, '#0c3d7a');
                    roundRect(ctx, cx2, cy2, cw, ch, 6, bg2);
                    // diagonal diamond pattern
                    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                    ctx.lineWidth = 1;
                    var step = 10;
                    ctx.save();
                    ctx.beginPath(); ctx.rect(cx2+2, cy2+2, cw-4, ch-4); ctx.clip();
                    for (var d = -ch; d < cw+ch; d += step) {
                        ctx.beginPath(); ctx.moveTo(cx2+d, cy2); ctx.lineTo(cx2+d+ch, cy2+ch); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(cx2+d, cy2+ch); ctx.lineTo(cx2+d+ch, cy2); ctx.stroke();
                    }
                    ctx.restore();
                    // center diamond highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.18)';
                    ctx.save();
                    ctx.translate(cx2+cw/2, cy2+ch/2);
                    ctx.rotate(Math.PI/4);
                    ctx.fillRect(-8, -8, 16, 16);
                    ctx.restore();
                    // top gloss
                    var gloss = ctx.createLinearGradient(cx2, cy2, cx2, cy2+ch*0.45);
                    gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
                    gloss.addColorStop(1, 'rgba(255,255,255,0)');
                    roundRect(ctx, cx2, cy2, cw, ch*0.45, 6, gloss);
                }
            }
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['memorama'] = draw;
}());

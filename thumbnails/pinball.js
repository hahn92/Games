/* Miniatura de pinball para el catálogo. La carga thumbnails.js bajo demanda,
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
            // Dark neon background
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#0d0022');
            bg.addColorStop(1, '#1a0035');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // subtle grid
            ctx.strokeStyle = 'rgba(100,50,180,0.15)';
            ctx.lineWidth = 1;
            for (var gx = 0; gx < W; gx += 22) {
                ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
            }
            for (var gy = 0; gy < H; gy += 22) {
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
            }

            // side walls
            ctx.strokeStyle = '#3355aa';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(18, 55); ctx.lineTo(18, 155); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W-18, 55); ctx.lineTo(W-18, 155); ctx.stroke();
            // top wall
            ctx.beginPath(); ctx.moveTo(40, 40); ctx.lineTo(W-40, 40); ctx.stroke();
            // top-left
            ctx.beginPath(); ctx.moveTo(18, 55); ctx.lineTo(40, 40); ctx.stroke();
            // top-right
            ctx.beginPath(); ctx.moveTo(W-18, 55); ctx.lineTo(W-40, 40); ctx.stroke();
            // gutter guides
            ctx.beginPath(); ctx.moveTo(18, 155); ctx.lineTo(72, 185); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W-18, 155); ctx.lineTo(W-72, 185); ctx.stroke();

            // bumpers — 3 visible circles
            var bumpData = [
                { x: 80,    y: 90,  r: 18, score: '100' },
                { x: W-80,  y: 90,  r: 18, score: '100' },
                { x: W/2,   y: 120, r: 20, score: '150' },
            ];
            bumpData.forEach(function(b, idx) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
                ctx.fillStyle = idx === 2 ? '#ff512f' : '#1a0040';
                ctx.fill();
                ctx.strokeStyle = '#cc88ff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                // inner ring
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r - 5, 0, Math.PI*2);
                ctx.strokeStyle = idx === 2 ? '#ffcc00' : '#7733cc';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            // score pop over center bumper
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+150', W/2, 98);

            // ball (metallic circle)
            ctx.beginPath();
            ctx.arc(W/2 - 18, 155, 10, 0, Math.PI*2);
            ctx.fillStyle = '#d8d8ff';
            ctx.fill();
            ctx.strokeStyle = '#aaaaff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // flippers
            function drawThumbFlipper(px, py, len, angle) {
                var tx = px + Math.cos(angle) * len;
                var ty = py + Math.sin(angle) * len;
                var perp = angle + Math.PI / 2;
                var hw = 6, tw = 3;
                ctx.beginPath();
                ctx.moveTo(px + Math.cos(perp)*hw, py + Math.sin(perp)*hw);
                ctx.lineTo(px - Math.cos(perp)*hw, py - Math.sin(perp)*hw);
                ctx.lineTo(tx - Math.cos(perp)*tw, ty - Math.sin(perp)*tw);
                ctx.lineTo(tx + Math.cos(perp)*tw, ty + Math.sin(perp)*tw);
                ctx.closePath();
                ctx.fillStyle = '#8fd3f4';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            // left flipper angled up
            drawThumbFlipper(W/2 - 24, 192, 52, -0.32);
            // right flipper angled up
            drawThumbFlipper(W/2 + 24, 192, 52, Math.PI + 0.32);

            // Title bar
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, W, 28);
            ctx.fillStyle = '#8fd3f4';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PINBALL NEON', W/2, 14);

            // bottom bar
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, H - 28, W, 28);
            ctx.fillStyle = '#cc88ff';
            ctx.font = '12px monospace';
            ctx.fillText('FLIPPERS · BUMPERS · NEON', W/2, H - 14);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['pinball'] = draw;
}());

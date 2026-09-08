/* Miniatura de simon para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#0a0a0a');
            // 4 quadrants with radial gradients for depth
            var quads = [
                {col:'#27ae60', bright:'#2ecc71', dark:'#0d5c30', a:Math.PI,   b:1.5*Math.PI},
                {col:'#c0392b', bright:'#e74c3c', dark:'#5c0d08', a:1.5*Math.PI, b:2*Math.PI},
                {col:'#d68910', bright:'#f39c12', dark:'#6e4400', a:0.5*Math.PI, b:Math.PI},
                {col:'#2980b9', bright:'#3498db', dark:'#0d3c6b', a:0,           b:0.5*Math.PI},
            ];
            var active = 1; // red quad glowing
            var cx2 = W/2, cy2 = H/2, R = 106;
            quads.forEach(function(q, i) {
                // outer radial glow for active segment
                if (i === active) {
                    var glowG = ctx.createRadialGradient(cx2, cy2, 40, cx2, cy2, R+10);
                    glowG.addColorStop(0, q.bright + 'aa');
                    glowG.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = glowG;
                    ctx.beginPath(); ctx.moveTo(cx2, cy2);
                    ctx.arc(cx2, cy2, R+10, q.a, q.b);
                    ctx.closePath(); ctx.fill();
                }
                // radial gradient — brighter at rim, darker near centre
                var rg = ctx.createRadialGradient(cx2, cy2, 38, cx2, cy2, R);
                rg.addColorStop(0, i === active ? q.bright : q.dark);
                rg.addColorStop(0.5, i === active ? q.col : q.dark);
                rg.addColorStop(1, i === active ? q.bright : q.col + '99');
                ctx.fillStyle = rg;
                ctx.beginPath(); ctx.moveTo(cx2, cy2);
                ctx.arc(cx2, cy2, R, q.a, q.b);
                ctx.closePath(); ctx.fill();
                // active overlay highlight
                if (i === active) {
                    ctx.fillStyle = 'rgba(255,255,255,0.22)';
                    ctx.beginPath(); ctx.moveTo(cx2, cy2);
                    ctx.arc(cx2, cy2, R, q.a, q.b);
                    ctx.closePath(); ctx.fill();
                }
            });
            // divider lines
            ctx.strokeStyle = '#111'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(cx2, cy2-R); ctx.lineTo(cx2, cy2+R); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx2-R, cy2); ctx.lineTo(cx2+R, cy2); ctx.stroke();
            // centre circle with metallic gradient
            var centG = ctx.createRadialGradient(cx2-8, cy2-8, 2, cx2, cy2, 40);
            centG.addColorStop(0, '#555');
            centG.addColorStop(0.5, '#222');
            centG.addColorStop(1, '#0a0a0a');
            ctx.fillStyle = centG;
            ctx.beginPath(); ctx.arc(cx2, cy2, 40, 0, Math.PI*2); ctx.fill();
            // metallic rim
            ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx2, cy2, 40, 0, Math.PI*2); ctx.stroke();
            // inner button
            var btnG = ctx.createRadialGradient(cx2-5, cy2-5, 1, cx2, cy2, 22);
            btnG.addColorStop(0, '#888');
            btnG.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = btnG;
            ctx.beginPath(); ctx.arc(cx2, cy2, 22, 0, Math.PI*2); ctx.fill();
            // logo text with gradient
            var tg = ctx.createLinearGradient(cx2-24, cy2, cx2+24, cy2);
            tg.addColorStop(0, '#ccc');
            tg.addColorStop(0.5, '#fff');
            tg.addColorStop(1, '#ccc');
            ctx.fillStyle = tg;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SIMON', cx2, cy2);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['simon'] = draw;
}());

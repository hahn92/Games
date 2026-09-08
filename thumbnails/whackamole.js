/* Miniatura de whackamole para el catálogo. La carga thumbnails.js bajo demanda,
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
            // lawn gradient background
            var lawnG = ctx.createLinearGradient(0, 0, 0, H);
            lawnG.addColorStop(0, '#52b788');
            lawnG.addColorStop(1, '#1b4332');
            ctx.fillStyle = lawnG; ctx.fillRect(0, 0, W, H);
            // dirt patches texture
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (var di = 0; di < 12; di++) {
                ctx.beginPath(); ctx.ellipse(18*di+5, 100+Math.sin(di)*30, 12, 4, 0, 0, Math.PI*2); ctx.fill();
            }
            var holes = [[55,70],[165,70],[55,150],[165,150],[110,110]];
            holes.forEach(function(h, i) {
                // hole: radial gradient for depth
                var hg = ctx.createRadialGradient(h[0], h[1]+2, 0, h[0], h[1]+2, 26);
                hg.addColorStop(0, '#0a0a0a');
                hg.addColorStop(0.6, '#3e1f00');
                hg.addColorStop(1, '#6b3a1f');
                ctx.fillStyle = hg;
                ctx.beginPath(); ctx.ellipse(h[0], h[1]+5, 26, 10, 0, 0, Math.PI*2); ctx.fill();
                // outer dirt rim
                ctx.strokeStyle = '#5d3010'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.ellipse(h[0], h[1]+5, 26, 10, 0, 0, Math.PI*2); ctx.stroke();
                if (i === 2 || i === 4) {
                    // mole body — radial gradient brown
                    var mbG = ctx.createRadialGradient(h[0]-5, h[1]-15, 2, h[0], h[1]-5, 28);
                    mbG.addColorStop(0, '#c4956a');
                    mbG.addColorStop(0.5, '#8d6040');
                    mbG.addColorStop(1, '#4a2810');
                    ctx.fillStyle = mbG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-5, 22, 28, 0, 0, Math.PI); ctx.fill();
                    // face lighter
                    var faceG = ctx.createRadialGradient(h[0]-4, h[1]-16, 2, h[0], h[1]-12, 17);
                    faceG.addColorStop(0, '#d4b090');
                    faceG.addColorStop(0.6, '#b08060');
                    faceG.addColorStop(1, '#7a5030');
                    ctx.fillStyle = faceG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-12, 14, 16, 0, 0, Math.PI*2); ctx.fill();
                    // eyes
                    ctx.fillStyle = '#1a0a00';
                    ctx.beginPath(); ctx.arc(h[0]-5, h[1]-17, 3.5, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(h[0]+5, h[1]-17, 3.5, 0, Math.PI*2); ctx.fill();
                    // eye highlights
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(h[0]-4, h[1]-18.5, 1.2, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(h[0]+6, h[1]-18.5, 1.2, 0, Math.PI*2); ctx.fill();
                    // nose — pink radial
                    var noseG = ctx.createRadialGradient(h[0]-1, h[1]-12, 0, h[0], h[1]-11, 5);
                    noseG.addColorStop(0, '#ff80ab');
                    noseG.addColorStop(1, '#c2185b');
                    ctx.fillStyle = noseG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-11, 5, 4, 0, 0, Math.PI*2); ctx.fill();
                    // nose highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.beginPath(); ctx.arc(h[0]-1, h[1]-12.5, 1.5, 0, Math.PI*2); ctx.fill();
                    if (i === 4) {
                        // hammer handle — wood gradient
                        var handleG = ctx.createLinearGradient(h[0]+24, h[1]-50, h[0]+34, h[1]-26);
                        handleG.addColorStop(0, '#d4a55a');
                        handleG.addColorStop(0.5, '#a06830');
                        handleG.addColorStop(1, '#7a4a18');
                        ctx.fillStyle = handleG;
                        ctx.save();
                        ctx.translate(h[0]+28, h[1]-30);
                        ctx.rotate(0.5);
                        ctx.fillRect(-5, -20, 9, 24);
                        // hammer head — brick gradient
                        var headG = ctx.createLinearGradient(-15, -36, 15, -20);
                        headG.addColorStop(0, '#ef5350');
                        headG.addColorStop(0.5, '#b71c1c');
                        headG.addColorStop(1, '#7f0000');
                        ctx.fillStyle = headG;
                        ctx.fillRect(-14, -36, 28, 18);
                        // head highlight
                        ctx.fillStyle = 'rgba(255,150,150,0.4)';
                        ctx.fillRect(-12, -35, 24, 5);
                        ctx.restore();
                    }
                }
            });
            // grass strip bottom
            var grassG = ctx.createLinearGradient(0, 188, 0, H);
            grassG.addColorStop(0, '#52b788');
            grassG.addColorStop(1, '#2d6a4f');
            ctx.fillStyle = grassG; ctx.fillRect(0, 192, W, H-192);
            // grass blades
            [30,70,110,150,190].forEach(function(x){
                var bladeG = ctx.createLinearGradient(x, 192, x, 174);
                bladeG.addColorStop(0, '#40916c');
                bladeG.addColorStop(1, '#74c69d');
                ctx.fillStyle = bladeG;
                ctx.beginPath();
                ctx.moveTo(x, 192); ctx.lineTo(x-7, 175); ctx.lineTo(x, 183);
                ctx.lineTo(x+7, 175); ctx.closePath(); ctx.fill();
            });
        };

    (window.__thumbs = window.__thumbs || {})['whackamole'] = draw;
}());

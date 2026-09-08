/* Miniatura de flappybird para el catálogo. La carga thumbnails.js bajo demanda,
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
            // rich sky gradient
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#1a6688');
            sky.addColorStop(0.45, '#3ba3c8');
            sky.addColorStop(0.75, '#6ecff0');
            sky.addColorStop(1, '#a8e4f7');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            // volumetric clouds
            [[30,40,28],[120,28,20],[170,55,22]].forEach(function(cl){
                var cg = ctx.createRadialGradient(cl[0], cl[1], 0, cl[0], cl[1], cl[2]);
                cg.addColorStop(0, 'rgba(255,255,255,0.95)');
                cg.addColorStop(0.6, 'rgba(255,255,255,0.75)');
                cg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = cg;
                ctx.beginPath(); ctx.arc(cl[0], cl[1], cl[2], 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]-15, cl[1]+8, cl[2]-8, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]+15, cl[1]+8, cl[2]-8, 0, Math.PI*2); ctx.fill();
            });
            // helper: draw one pipe segment with gradient
            function drawPipe(px, py, pw, ph, capTop) {
                var pg = ctx.createLinearGradient(px, py, px+pw, py);
                pg.addColorStop(0, '#4a9e1a');
                pg.addColorStop(0.3, '#73c42f');
                pg.addColorStop(0.7, '#5eb024');
                pg.addColorStop(1, '#2e7010');
                ctx.fillStyle = pg;
                ctx.fillRect(px, py, pw, ph);
                // pipe highlight stripe
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(px+4, py, 6, ph);
                // cap
                var capH = 20, capX = px-5, capW = pw+10;
                var capPy = capTop ? py+ph-capH : py;
                var capG = ctx.createLinearGradient(capX, capPy, capX+capW, capPy);
                capG.addColorStop(0, '#3d8c18');
                capG.addColorStop(0.3, '#6bb82a');
                capG.addColorStop(0.7, '#52a020');
                capG.addColorStop(1, '#264f0a');
                roundRect(ctx, capX, capPy, capW, capH, 3, capG);
                // cap highlight
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(capX+4, capPy+3, 8, capH-6);
            }
            drawPipe(60, 0, 44, 80, true);   // top pipe left
            drawPipe(60, 130, 44, H-130, false); // bottom pipe left
            drawPipe(160, 0, 44, 60, true);  // top pipe right
            drawPipe(160, 150, 44, H-150, false); // bottom pipe right
            // ground gradient
            var groundG = ctx.createLinearGradient(0, H-28, 0, H);
            groundG.addColorStop(0, '#a8865a');
            groundG.addColorStop(1, '#7a5c38');
            ctx.fillStyle = groundG; ctx.fillRect(0, H-24, W, 24);
            // grass strip
            var grassG = ctx.createLinearGradient(0, H-28, 0, H-20);
            grassG.addColorStop(0, '#8be028');
            grassG.addColorStop(1, '#5caa18');
            ctx.fillStyle = grassG; ctx.fillRect(0, H-28, W, 8);
            // bird body gradient
            var bx = 115, by = 95;
            var birdG = ctx.createRadialGradient(bx-4, by-4, 0, bx, by, 18);
            birdG.addColorStop(0, '#ffe066');
            birdG.addColorStop(0.5, '#f9c23c');
            birdG.addColorStop(1, '#e08c00');
            ctx.fillStyle = birdG;
            ctx.beginPath(); ctx.ellipse(bx, by, 16, 13, -0.15, 0, Math.PI*2); ctx.fill();
            // bird eye white
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(bx+6, by-4, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(bx+8, by-4, 3, 0, Math.PI*2); ctx.fill();
            // eye highlight
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(bx+9, by-5.5, 1.2, 0, Math.PI*2); ctx.fill();
            // beak
            ctx.fillStyle = '#e8590c';
            ctx.beginPath(); ctx.moveTo(bx+12, by+1); ctx.lineTo(bx+23, by-2); ctx.lineTo(bx+12, by+5); ctx.closePath(); ctx.fill();
            // beak highlight
            ctx.fillStyle = 'rgba(255,200,100,0.5)';
            ctx.beginPath(); ctx.moveTo(bx+13, by+1); ctx.lineTo(bx+21, by-1); ctx.lineTo(bx+13, by+2); ctx.closePath(); ctx.fill();
            // wing gradient
            var wingG = ctx.createRadialGradient(bx-4, by+2, 0, bx-4, by+3, 10);
            wingG.addColorStop(0, '#ffc840');
            wingG.addColorStop(1, '#d47a00');
            ctx.fillStyle = wingG;
            ctx.beginPath(); ctx.ellipse(bx-4, by+3, 8, 5, -0.4, 0, Math.PI*2); ctx.fill();
            // bird highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.ellipse(bx-5, by-5, 6, 4, -0.4, 0, Math.PI*2); ctx.fill();
        };

    (window.__thumbs = window.__thumbs || {})['flappybird'] = draw;
}());

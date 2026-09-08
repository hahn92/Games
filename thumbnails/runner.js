/* Miniatura de runner para el catálogo. La carga thumbnails.js bajo demanda,
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
            // night sky gradient
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#060614');
            sky.addColorStop(0.6, '#1a1a2e');
            sky.addColorStop(1, '#2c2c4a');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            // stars varied sizes
            [[20,20,1],[60,15,2],[100,30,1],[150,12,2],[190,22,1],[35,45,1],[80,50,2],[130,40,1],[10,55,1],[170,30,1]].forEach(function(s){
                ctx.fillStyle = s[2]===2 ? 'rgba(255,255,255,0.9)':'rgba(255,255,255,0.5)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // moon halo
            var moonHalo = ctx.createRadialGradient(185, 25, 10, 185, 25, 30);
            moonHalo.addColorStop(0, 'rgba(255,230,100,0.25)');
            moonHalo.addColorStop(1, 'rgba(255,230,100,0)');
            ctx.fillStyle = moonHalo; ctx.fillRect(155, 0, 60, 60);
            // moon body
            var moonG = ctx.createRadialGradient(182, 22, 1, 185, 25, 12);
            moonG.addColorStop(0, '#fff8c0');
            moonG.addColorStop(0.6, '#ffe066');
            moonG.addColorStop(1, '#c8a800');
            ctx.fillStyle = moonG;
            ctx.beginPath(); ctx.arc(185, 25, 12, 0, Math.PI*2); ctx.fill();
            // moon crescent shadow
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(190, 22, 10, 0, Math.PI*2); ctx.fill();
            // ground sandy gradient
            var groundG = ctx.createLinearGradient(0, 162, 0, H);
            groundG.addColorStop(0, '#e9c46a');
            groundG.addColorStop(0.15, '#d4a843');
            groundG.addColorStop(1, '#8b6020');
            ctx.fillStyle = groundG; ctx.fillRect(0, 162, W, H-162);
            // ground line
            ctx.fillStyle = '#7a5010'; ctx.fillRect(0, 162, W, 4);
            // cactus helper
            function drawCactus(cx, cy, w, h) {
                var cg = ctx.createLinearGradient(cx, cy, cx+w, cy);
                cg.addColorStop(0, '#1a7a6e');
                cg.addColorStop(0.4, '#2a9d8f');
                cg.addColorStop(1, '#1a6060');
                ctx.fillStyle = cg;
                roundRect(ctx, cx, cy, w, h, Math.min(w/2, 4), cg);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(cx+2, cy+4, 3, h-8);
            }
            // cactus 1
            drawCactus(150, 118, 10, 48);
            drawCactus(136, 130, 12, 8);  // left arm
            drawCactus(128, 118, 8, 20);
            drawCactus(160, 126, 10, 8); // right arm base
            drawCactus(162, 118, 8, 16);
            // cactus 2 small
            drawCactus(191, 138, 8, 28);
            drawCactus(183, 143, 14, 6);
            // cactus shadows
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(154, 166, 16, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(195, 166, 8, 3, 0, 0, Math.PI*2); ctx.fill();
            // dino body gradient
            var dx = 50, dy = 128;
            var dinoG = ctx.createLinearGradient(dx, dy, dx+35, dy+32);
            dinoG.addColorStop(0, '#6ab88a');
            dinoG.addColorStop(0.5, '#4a9c6d');
            dinoG.addColorStop(1, '#2d7050');
            // dino shadow
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(dx+16, 162, 20, 5, 0, 0, Math.PI*2); ctx.fill();
            // body
            ctx.fillStyle = dinoG;
            ctx.fillRect(dx, dy, 32, 28);
            // head
            var headG = ctx.createLinearGradient(dx+18, dy-18, dx+36, dy+2);
            headG.addColorStop(0, '#7acc96');
            headG.addColorStop(1, '#3a8c5d');
            ctx.fillStyle = headG;
            ctx.fillRect(dx+18, dy-16, 18, 18);
            // snout
            ctx.fillStyle = '#4a9c6d';
            ctx.fillRect(dx+28, dy-10, 12, 7);
            // eye white + pupil
            ctx.fillStyle = '#fff';
            ctx.fillRect(dx+30, dy-14, 7, 5);
            ctx.fillStyle = '#111';
            ctx.fillRect(dx+33, dy-13, 3, 4);
            ctx.fillStyle = '#fff';
            ctx.fillRect(dx+34, dy-13, 1, 1);
            // legs run pose
            ctx.fillStyle = '#3a7050';
            ctx.fillRect(dx+4, dy+28, 8, 16);
            ctx.fillRect(dx+18, dy+28, 8, 8);
            // tail
            ctx.fillStyle = '#4a9c6d';
            ctx.beginPath(); ctx.moveTo(dx, dy+8); ctx.quadraticCurveTo(dx-10, dy+12, dx-6, dy+20); ctx.lineTo(dx, dy+16); ctx.closePath(); ctx.fill();
            // belly highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(dx+4, dy+4, 10, 18);
            // score
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('01480', W-8, 20);
        };

    (window.__thumbs = window.__thumbs || {})['runner'] = draw;
}());

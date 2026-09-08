/* Miniatura de dardos para el catálogo. La carga thumbnails.js bajo demanda,
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
            // fondo oscuro
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#120a24');
            bg.addColorStop(1, '#1a0838');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            // estrellas (puntos fijos)
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            var stars = [[18,12],[55,28],[100,8],[175,40],[250,18],[310,35],[40,65],[130,55],[200,70],[290,50],[350,22]];
            for (var si = 0; si < stars.length; si++) ctx.fillRect(stars[si][0], stars[si][1], 1.5, 1.5);

            // diana giratoria
            var cx = W / 2, cy = 92;
            var R = 68;
            var rings = [
                {r: R,        fill: '#1a0a2e'},
                {r: R * 0.82, fill: '#2d1b4e'},
                {r: R * 0.62, fill: '#1a0a2e'},
                {r: R * 0.42, fill: '#3d2b5e'},
                {r: R * 0.24, fill: '#ff512f'},
                {r: R * 0.10, fill: '#fff'},
            ];
            for (var ri = 0; ri < rings.length; ri++) {
                ctx.beginPath(); ctx.arc(cx, cy, rings[ri].r, 0, Math.PI * 2);
                ctx.fillStyle = rings[ri].fill; ctx.fill();
                ctx.strokeStyle = 'rgba(143,211,244,0.3)'; ctx.lineWidth = 1; ctx.stroke();
            }
            // sector lines
            ctx.strokeStyle = 'rgba(143,211,244,0.15)'; ctx.lineWidth = 1;
            for (var si2 = 0; si2 < 8; si2++) {
                var a = (si2 / 8) * Math.PI * 2;
                ctx.beginPath(); ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
            }
            // glow ring
            ctx.shadowColor = '#8fd3f4'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2; ctx.stroke();
            ctx.shadowBlur = 0;

            // dardos clavados (5 dardos en distintos ángulos)
            var stuck = [
                {rel: -0.4,  color: '#8fd3f4'},
                {rel:  0.7,  color: '#ff512f'},
                {rel:  1.9,  color: '#ffd700'},
                {rel: -1.8,  color: '#7fff7f'},
                {rel:  3.0,  color: '#ff80ab'},
            ];
            var boardAngle = 0.3;
            ctx.lineCap = 'round';
            for (var di = 0; di < stuck.length; di++) {
                var globalA = stuck[di].rel + boardAngle;
                var tx = cx + Math.cos(globalA) * (R - 2);
                var ty = cy + Math.sin(globalA) * (R - 2);
                ctx.strokeStyle = stuck[di].color; ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx + Math.cos(globalA) * 20, ty + Math.sin(globalA) * 20);
                ctx.stroke();
                ctx.fillStyle = stuck[di].color;
                ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill();
            }

            // dardo en vuelo (desde abajo)
            ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 7;
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(cx, cy + R + 30); ctx.lineTo(cx, cy + R + 8); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(cx, cy + R + 8, 3.5, 0, Math.PI * 2); ctx.fill();

            // barra de progreso
            var bY = cy + R + 42, bW = 120, bH = 7;
            var bX = (W - bW) / 2;
            ctx.fillStyle = 'rgba(36,36,36,0.7)';
            ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 3); ctx.fill();
            var grad = ctx.createLinearGradient(bX, 0, bX + bW, 0);
            grad.addColorStop(0, '#8fd3f4'); grad.addColorStop(1, '#ff512f');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.roundRect(bX, bY, bW * (5 / 6), bH, 3); ctx.fill();

            // texto
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 11px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText('5/6 dardos  Niv.1', W / 2, bY + bH + 4);
        };

    (window.__thumbs = window.__thumbs || {})['dardos'] = draw;
}());

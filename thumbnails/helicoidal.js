/* Miniatura de helicoidal para el catálogo. La carga thumbnails.js bajo demanda,
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
            // fondo: cielo cósmico con degradado vertical
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#120635');
            sky.addColorStop(0.55, '#2a1260');
            sky.addColorStop(1, '#601e8c');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            for (var i = 0; i < 36; i++) {
                var sx = (i * 61) % W;
                var sy = ((i * 37) % H);
                ctx.fillRect(sx, sy, (i % 4 === 0) ? 2 : 1, (i % 4 === 0) ? 2 : 1);
            }

            // poste central vertical
            var px = W / 2 - 10;
            var poleG = ctx.createLinearGradient(px, 0, px + 20, 0);
            poleG.addColorStop(0, '#100423');
            poleG.addColorStop(0.5, '#2a1644');
            poleG.addColorStop(1, '#100423');
            ctx.fillStyle = poleG; ctx.fillRect(px, 0, 20, H);
            ctx.fillStyle = 'rgba(255,255,255,0.09)';
            ctx.fillRect(px + 7, 0, 3, H);

            // discos elípticos apilados
            var cx = W / 2, rx = 95, ry = 14;
            var discs = [
                { y: 48,  rotOffset: 0.0,  palette: 'cyan',   reds: [2],    gaps: [6] },
                { y: 100, rotOffset: 0.35, palette: 'teal',   reds: [1, 5], gaps: [3] },
                { y: 160, rotOffset: 0.8,  palette: 'cyan',   reds: [0, 4], gaps: [7] },
                { y: 205, rotOffset: 1.15, palette: 'teal',   reds: [3],    gaps: [1, 5] },
            ];

            function drawWedge(cx, cy, rx, ry, a0, a1, fillGrad, alpha) {
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
                ctx.closePath();
                ctx.fillStyle = fillGrad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(10,4,30,0.6)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            discs.forEach(function (d) {
                for (var s = 0; s < 8; s++) {
                    var a0 = d.rotOffset + s * Math.PI / 4;
                    var a1 = a0 + Math.PI / 4;
                    var aMid = (a0 + a1) / 2;
                    var inFront = Math.sin(aMid) > 0;
                    var isGap = d.gaps.indexOf(s) >= 0;
                    var isRed = d.reds.indexOf(s) >= 0;
                    if (isGap) continue;
                    var g;
                    if (isRed) {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#ff7566');
                        g.addColorStop(1, '#a81e14');
                    } else if (d.palette === 'cyan') {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#6fd3ff');
                        g.addColorStop(1, '#2a74a8');
                    } else {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#7be0b3');
                        g.addColorStop(1, '#2e8a5d');
                    }
                    drawWedge(cx, d.y, rx, ry, a0, a1, g, inFront ? 1 : 0.65);
                }
                // anillo exterior sutil
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(cx, d.y, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            });

            // sombra bajo la bola (en el disco de nivel 160)
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx + 2, 158, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            // bola (rebotando sobre el disco medio-alto)
            var bx = cx, by = 135;
            var bg = ctx.createRadialGradient(bx - 4, by - 5, 1, bx, by, 16);
            bg.addColorStop(0, '#ffd866');
            bg.addColorStop(0.55, '#ff9f45');
            bg.addColorStop(1, '#8f1a06');
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.arc(bx - 4, by - 5, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a0e04';
            ctx.fillRect(bx + 3, by - 1, 2, 2);

            // partículas de rebote (amarillas)
            ctx.fillStyle = '#ffd866';
            [[cx - 10, 148], [cx + 14, 150], [cx - 18, 154], [cx + 20, 146], [cx - 4, 158]].forEach(function (p) {
                ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
            });

            // indicador de rotación (flechas circulares debajo)
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(W / 2, H - 30, 22, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.moveTo(W / 2 - 22, H - 38);
            ctx.lineTo(W / 2 - 32, H - 30);
            ctx.lineTo(W / 2 - 22, H - 22);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(W / 2 + 22, H - 38);
            ctx.lineTo(W / 2 + 32, H - 30);
            ctx.lineTo(W / 2 + 22, H - 22);
            ctx.closePath(); ctx.fill();

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Puntos: 12', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 48', W - 8, 11);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

            // Combo flash
            ctx.fillStyle = '#ffd866';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('x3', W / 2, 42);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['helicoidal'] = draw;
}());

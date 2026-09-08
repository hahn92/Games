/* Miniatura de ritmo para el catálogo. La carga thumbnails.js bajo demanda,
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
            // fondo degradado púrpura/azul estilo escenario nocturno
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#130738');
            bgG.addColorStop(0.55, '#2a0d5a');
            bgG.addColorStop(1, '#090218');
            ctx.fillStyle = bgG;
            ctx.fillRect(0, 0, W, H);

            // estrellas sutiles
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            var stars = [[20,18],[48,52],[90,30],[140,70],[180,22],[210,60],
                         [40,100],[110,120],[170,130],[200,150]];
            stars.forEach(function (s) { ctx.fillRect(s[0], s[1], 1, 1); });

            // 4 carriles con líneas suaves
            var laneW = W / 4;
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (var l = 1; l < 4; l++) {
                ctx.beginPath();
                ctx.moveTo(l * laneW, 0);
                ctx.lineTo(l * laneW, H);
                ctx.stroke();
            }

            // banda de zona de golpe (glow translúcido)
            var hitY = H - 52;
            ctx.fillStyle = 'rgba(143,211,244,0.25)';
            ctx.fillRect(0, hitY - 22, W, 44);

            // línea de impacto brillante
            ctx.strokeStyle = '#8fd3f4';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, hitY);
            ctx.lineTo(W, hitY);
            ctx.stroke();
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath(); ctx.arc(6, hitY, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(W - 6, hitY, 3, 0, Math.PI * 2); ctx.fill();

            // paletas de tiles por carril
            var palettes = [
                { a: '#ff7ad9', b: '#a8247d' },   // rosa
                { a: '#ffd866', b: '#c27a11' },   // oro
                { a: '#7bf0c6', b: '#1e8a64' },   // turquesa
                { a: '#8fb4ff', b: '#2b4fa8' }    // azul
            ];

            // bloques cayendo en cada carril a distinta altura
            var blocks = [
                { lane: 0, y: 40,  h: 48 },
                { lane: 1, y: 90,  h: 48 },
                { lane: 2, y: hitY - 24, h: 48 }, // justo sobre la línea — "a punto de tocar"
                { lane: 3, y: 150, h: 48 }
            ];
            blocks.forEach(function (b) {
                var x = b.lane * laneW + 6;
                var w = laneW - 12;
                var pal = palettes[b.lane];
                // cuerpo con gradiente vertical
                var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
                g.addColorStop(0, pal.a);
                g.addColorStop(1, pal.b);
                roundRect(ctx, x, b.y, w, b.h, 10, g, 'rgba(255,255,255,0.35)');
                // highlight superior
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                roundRect(ctx, x + 4, b.y + 4, w - 8, 8, 5, 'rgba(255,255,255,0.25)');
                // onda de sonido decorativa
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                var midY = b.y + b.h * 0.68;
                ctx.moveTo(x + 8, midY);
                ctx.lineTo(x + w * 0.28, midY - 5);
                ctx.lineTo(x + w * 0.5,  midY + 5);
                ctx.lineTo(x + w * 0.72, midY - 5);
                ctx.lineTo(x + w - 8, midY);
                ctx.stroke();
            });

            // pulso/flash en el carril 2 (el que "acaba de acertarse")
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = palettes[2].a;
            ctx.fillRect(2 * laneW, 0, laneW, H);
            ctx.globalAlpha = 1;

            // anillo expansivo en la línea de impacto
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(2 * laneW + laneW / 2, hitY, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(2 * laneW + laneW / 2, hitY, 36, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // HUD superior
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Puntos: 24', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 97', W - 8, 11);

            // combo en el centro
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd866';
            ctx.font = 'bold 18px monospace';
            ctx.fillText('x4', W / 2, 40);

            // corazones de vida (esquina derecha bajo HUD)
            function tinyHeart(hx, hy, on) {
                var sz = 10;
                ctx.fillStyle = on ? '#ff5a7a' : '#3a1c2a';
                ctx.beginPath();
                ctx.moveTo(hx, hy + sz * 0.3);
                ctx.bezierCurveTo(hx, hy, hx - sz * 0.55, hy, hx - sz * 0.55, hy + sz * 0.35);
                ctx.bezierCurveTo(hx - sz * 0.55, hy + sz * 0.65, hx, hy + sz * 0.85, hx, hy + sz);
                ctx.bezierCurveTo(hx, hy + sz * 0.85, hx + sz * 0.55, hy + sz * 0.65, hx + sz * 0.55, hy + sz * 0.35);
                ctx.bezierCurveTo(hx + sz * 0.55, hy, hx, hy, hx, hy + sz * 0.3);
                ctx.closePath();
                ctx.fill();
            }
            tinyHeart(W - 12, 30, true);
            tinyHeart(W - 28, 30, true);
            tinyHeart(W - 44, 30, false);

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['ritmo'] = draw;
}());

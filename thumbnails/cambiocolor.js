/* Miniatura de cambiocolor para el catálogo. La carga thumbnails.js bajo demanda,
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
            // Fondo gradiente noche profunda
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0,    '#140b35');
            bgG.addColorStop(0.55, '#24093e');
            bgG.addColorStop(1,    '#06031a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

            // Estrellas sutiles (fillRect, barato)
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            var stars = [[18,22],[50,60],[92,34],[140,80],[178,26],[205,58],
                         [42,108],[112,130],[170,140],[200,168],[30,180],[150,195]];
            stars.forEach(function (s) { ctx.fillRect(s[0], s[1], 1, 1); });

            // Línea vertical de la trayectoria de la pelota
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
            ctx.stroke();

            // Paleta del juego
            var palette = [
                { main: '#ff3aa4', glow: '#ff8ac4' },  // magenta
                { main: '#40d4ff', glow: '#8ce8ff' },  // cian
                { main: '#ffd54a', glow: '#ffe994' },  // ámbar
                { main: '#6ef26e', glow: '#b6fbaa' }   // verde lima
            ];

            // ── Anillo grande rotado ~15° con 4 sectores de color
            var cx = W / 2;
            var ringY = 78;
            var RR = 62;    // radio externo
            var Rr = 44;    // radio interno
            var rot = -0.35;// ligera inclinación

            // halo tenue exterior (sin shadowBlur — sólo un arco translúcido)
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = palette[1].glow;
            ctx.lineWidth = (RR - Rr) + 8;
            ctx.beginPath(); ctx.arc(cx, ringY, (RR + Rr) / 2, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;

            // 4 arcos principales de colores
            var radius = (RR + Rr) / 2;
            ctx.lineWidth = RR - Rr;
            for (var i = 0; i < 4; i++) {
                var a0 = rot + i * (Math.PI / 2);
                var a1 = a0 + Math.PI / 2;
                ctx.strokeStyle = palette[i].main;
                ctx.beginPath();
                ctx.arc(cx, ringY, radius, a0, a1);
                ctx.stroke();
            }
            // bordes finos del anillo
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.arc(cx, ringY, RR, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, ringY, Rr, 0, Math.PI * 2); ctx.stroke();

            // ── Orbe multicolor entre anillo y pelota
            var orbX = cx, orbY = 150, orbR = 12;
            for (var k = 0; k < 4; k++) {
                ctx.fillStyle = palette[k].main;
                ctx.beginPath();
                ctx.moveTo(orbX, orbY);
                ctx.arc(orbX, orbY, orbR,
                        k * Math.PI / 2 + 0.4,
                        (k + 1) * Math.PI / 2 + 0.4);
                ctx.closePath();
                ctx.fill();
            }
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2); ctx.stroke();
            // núcleo brillante
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath(); ctx.arc(orbX - 2, orbY - 3, 2, 0, Math.PI * 2); ctx.fill();

            // ── Pelota (cian) en la parte baja con trail
            var ballX = cx, ballY = 176, ballR = 11;
            var pal = palette[1];  // color actual: cian
            // trail
            for (var t = 0; t < 5; t++) {
                var ty = ballY + 8 + t * 6;
                ctx.globalAlpha = 0.18 + (4 - t) * 0.04;
                ctx.fillStyle = pal.glow;
                ctx.beginPath();
                ctx.arc(ballX, ty, ballR * (0.5 + (4 - t) * 0.06), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // cuerpo con gradient radial
            var bg = ctx.createRadialGradient(
                ballX - 4, ballY - 5, 1,
                ballX, ballY, ballR + 2
            );
            bg.addColorStop(0, pal.glow);
            bg.addColorStop(0.55, pal.main);
            bg.addColorStop(1, '#000');
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 1.3;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.stroke();
            // highlight
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.arc(ballX - 4, ballY - 5, 3.2, 0, Math.PI * 2);
            ctx.fill();

            // HUD superior
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Puntos: 17', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 42', W - 8, 11);

            // Indicador "Tu color" abajo a la izquierda
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(6, H - 26, 86, 20);
            ctx.fillStyle = pal.main;
            ctx.fillRect(12, H - 22, 12, 12);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(12, H - 22, 12, 12);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Tu color', 30, H - 16);

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['cambiocolor'] = draw;
}());

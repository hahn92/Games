/* Miniatura de cosecha para el catálogo. La carga thumbnails.js bajo demanda,
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
            // cielo + horizonte + tierra
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#3a5d8c');
            sky.addColorStop(0.45, '#d99450');
            sky.addColorStop(0.55, '#5e3a18');
            sky.addColorStop(1, '#1a0f06');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            // sol
            ctx.fillStyle = 'rgba(255,213,120,0.45)';
            ctx.beginPath(); ctx.arc(W * 0.18, 38, 22, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,240,180,0.85)';
            ctx.beginPath(); ctx.arc(W * 0.18, 38, 9, 0, Math.PI * 2); ctx.fill();

            // grid 3x3 de parcelas
            var pad = 14;
            var topY = 72;
            var cellW = (W - pad * 4) / 3;
            var cellH = (H - topY - 18) / 3;

            function plot(px, py, plant, mature) {
                // sombra
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.moveTo(px + 8, py + 4);
                ctx.lineTo(px + cellW - 4, py + 4);
                ctx.lineTo(px + cellW - 4, py + cellH + 2);
                ctx.lineTo(px + 8, py + cellH + 2);
                ctx.closePath(); ctx.fill();
                // tierra
                var g = ctx.createLinearGradient(0, py, 0, py + cellH);
                g.addColorStop(0, '#7a4a22');
                g.addColorStop(1, '#3e2210');
                ctx.fillStyle = g;
                roundRect(ctx, px, py, cellW, cellH, 8, g);
                // surcos
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
                for (var i = 1; i <= 2; i++) {
                    var ly = py + cellH * (i / 3);
                    ctx.beginPath(); ctx.moveTo(px + 6, ly); ctx.lineTo(px + cellW - 6, ly); ctx.stroke();
                }
                ctx.strokeStyle = '#2d1808'; ctx.lineWidth = 2;
                roundRect(ctx, px, py, cellW, cellH, 8, null, '#2d1808');

                // contenido (planta o vacío)
                var cx = px + cellW / 2;
                var cy = py + cellH / 2;
                if (plant === 'wheat') {
                    // tallos verdes y espigas
                    ctx.strokeStyle = '#2e7d2e'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy - 16); ctx.stroke();
                    ctx.strokeStyle = '#e9c66b'; ctx.lineWidth = 2;
                    for (var s = 0; s < 4; s++) {
                        var sy = cy - 14 + s * 4;
                        ctx.beginPath(); ctx.moveTo(cx - 6, sy); ctx.lineTo(cx + 6, sy - 1); ctx.stroke();
                    }
                } else if (plant === 'corn') {
                    ctx.strokeStyle = '#2e7d2e'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy - 18); ctx.stroke();
                    ctx.fillStyle = '#ffd83a';
                    roundRect(ctx, cx - 5, cy - 18, 10, 22, 4, '#ffd83a');
                    ctx.fillStyle = '#2e7d2e';
                    ctx.beginPath();
                    ctx.moveTo(cx - 6, cy - 4);
                    ctx.quadraticCurveTo(cx - 14, cy - 12, cx - 3, cy - 18);
                    ctx.lineTo(cx, cy - 18); ctx.lineTo(cx, cy - 4);
                    ctx.closePath(); ctx.fill();
                } else if (plant === 'pumpkin') {
                    var pr = 18;
                    var pg = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, pr);
                    pg.addColorStop(0, '#ffb066');
                    pg.addColorStop(0.6, '#ff7a1f');
                    pg.addColorStop(1, '#a44a08');
                    ctx.fillStyle = pg;
                    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(110,50,5,0.6)'; ctx.lineWidth = 1.5;
                    for (var k = -1; k <= 1; k++) {
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, pr * 0.35 + k * pr * 0.28, pr, 0, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.strokeStyle = '#2e7d2e'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.moveTo(cx, cy - pr); ctx.lineTo(cx + 4, cy - pr - 8); ctx.stroke();
                } else {
                    // vacío: punto leve
                    ctx.fillStyle = 'rgba(255,213,74,0.5)';
                    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
                }

                // halo dorado si maduro
                if (mature) {
                    ctx.strokeStyle = 'rgba(255,213,74,0.85)';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.stroke();
                }
            }

            // Disposición de la granja del thumbnail
            var arrangement = [
                ['wheat', false],   ['corn', true],   ['pumpkin', false],
                [null, false],      ['wheat', true],  ['corn', false],
                ['pumpkin', true],  [null, false],    ['wheat', false]
            ];
            for (var r = 0; r < 3; r++) {
                for (var c = 0; c < 3; c++) {
                    var idx = r * 3 + c;
                    var px = pad + c * (cellW + pad);
                    var py = topY + r * (cellH + 2);
                    plot(px, py, arrangement[idx][0], arrangement[idx][1]);
                }
            }

            // Banda HUD top: monedas y temporizador
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 60);
            // moneda izq
            var cx = 24, cy = 28;
            var mg = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 11);
            mg.addColorStop(0, '#fff3a0'); mg.addColorStop(0.6, '#ffd54a'); mg.addColorStop(1, '#b27d1a');
            ctx.fillStyle = mg;
            ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#7a5210'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#ffd54a';
            ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('42', 40, 30);
            // tiempo derecha
            ctx.fillStyle = '#ff8a5a';
            ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('27s', W - 14, 30);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['cosecha'] = draw;
}());

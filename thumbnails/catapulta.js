/* Miniatura de catapulta para el catálogo. La carga thumbnails.js bajo demanda,
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
            // cielo con degradado (noche / atardecer)
            var skyG = ctx.createLinearGradient(0, 0, 0, H);
            skyG.addColorStop(0, '#182b55');
            skyG.addColorStop(0.55, '#4d3a7d');
            skyG.addColorStop(1, '#8b5a83');
            ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

            // estrellas puntuales
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            for (var i = 0; i < 24; i++) {
                var sx = (i * 67) % W;
                var sy = ((i * 37) % 120) + 8;
                ctx.fillRect(sx, sy, (i % 4 === 0) ? 2 : 1, (i % 4 === 0) ? 2 : 1);
            }

            // montañas al fondo
            ctx.fillStyle = '#28294f';
            ctx.beginPath();
            ctx.moveTo(0, 150);
            ctx.lineTo(40, 120); ctx.lineTo(85, 140);
            ctx.lineTo(130, 110); ctx.lineTo(170, 135);
            ctx.lineTo(210, 118); ctx.lineTo(W, 145);
            ctx.lineTo(W, 175); ctx.lineTo(0, 175);
            ctx.closePath(); ctx.fill();

            // suelo
            var gg = ctx.createLinearGradient(0, 175, 0, H);
            gg.addColorStop(0, '#5b3e1f');
            gg.addColorStop(0.35, '#8a6038');
            gg.addColorStop(1, '#4a351f');
            ctx.fillStyle = gg; ctx.fillRect(0, 175, W, H - 175);
            ctx.fillStyle = '#3fa250'; ctx.fillRect(0, 172, W, 4);

            // luna
            ctx.fillStyle = '#f3eecf';
            ctx.beginPath(); ctx.arc(180, 44, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(190,184,150,0.5)';
            ctx.beginPath(); ctx.arc(174, 40, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(184, 50, 2.5, 0, Math.PI * 2); ctx.fill();

            // ── torres de bloques apilados en el suelo ──
            var groundY = 172, bh = 22;
            function thumbBlock(bx, by, bw, type) {
                if (type === 'tnt') {
                    ctx.fillStyle = '#b8342a'; ctx.fillRect(bx, by, bw, bh);
                    ctx.strokeStyle = '#5e1812'; ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by + bh);
                    ctx.moveTo(bx + bw, by); ctx.lineTo(bx, by + bh); ctx.stroke();
                    ctx.fillStyle = '#ffe08a'; ctx.fillRect(bx + 2, by + bh / 2 - 3, bw - 4, 6);
                    ctx.fillStyle = '#7a1f17'; ctx.font = 'bold 6px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('TNT', bx + bw / 2, by + bh / 2 + 0.5);
                    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                } else if (type === 'wood') {
                    var wg = ctx.createLinearGradient(bx, by, bx, by + bh);
                    wg.addColorStop(0, '#a87a44'); wg.addColorStop(1, '#7a5128');
                    ctx.fillStyle = wg; ctx.fillRect(bx, by, bw, bh);
                    ctx.strokeStyle = 'rgba(60,38,18,0.5)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(bx, by + bh / 2); ctx.lineTo(bx + bw, by + bh / 2); ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, 2);
                } else {
                    var sg = ctx.createLinearGradient(bx, by, bx, by + bh);
                    sg.addColorStop(0, '#9aa6ad'); sg.addColorStop(1, '#5b6970');
                    ctx.fillStyle = sg; ctx.fillRect(bx, by, bw, bh);
                    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(bx, by, bw, 2);
                    ctx.strokeStyle = 'rgba(40,52,60,0.55)'; ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(bx, by + bh / 2); ctx.lineTo(bx + bw, by + bh / 2);
                    ctx.moveTo(bx + bw / 2, by); ctx.lineTo(bx + bw / 2, by + bh / 2); ctx.stroke();
                }
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
                ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
            }
            // torre A (x≈116): piedra + madera
            thumbBlock(112, groundY - bh, 26, 'stone');
            thumbBlock(112, groundY - bh * 2, 26, 'wood');
            // torre B (x≈150): piedra + TNT + madera (objetivo del impacto)
            thumbBlock(148, groundY - bh, 26, 'stone');
            thumbBlock(148, groundY - bh * 2, 26, 'tnt');
            // torre C (x≈186): piedra + piedra
            thumbBlock(184, groundY - bh, 28, 'stone');
            thumbBlock(184, groundY - bh * 2, 28, 'stone');

            // ── catapulta de madera (armazón en A + brazo) ──
            var PVX = 44, PVY = 150;
            // ruedas
            ctx.fillStyle = '#2a2018';
            ctx.beginPath(); ctx.arc(PVX - 13, 174, 7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(PVX + 13, 174, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5a4326';
            ctx.beginPath(); ctx.arc(PVX - 13, 174, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(PVX + 13, 174, 3, 0, Math.PI * 2); ctx.fill();
            // base
            ctx.fillStyle = '#6b4a26'; ctx.fillRect(PVX - 22, 164, 44, 7);
            ctx.fillStyle = '#855e30'; ctx.fillRect(PVX - 22, 164, 44, 2);
            // armazón en A
            ctx.strokeStyle = '#7a4e22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(PVX - 11, 165); ctx.lineTo(PVX, PVY);
            ctx.moveTo(PVX + 11, 165); ctx.lineTo(PVX, PVY); ctx.stroke();
            // brazo lanzador tensado hacia atrás-abajo (con la roca en la cuchara)
            var cupX = PVX - 18, cupY = PVY + 14;
            ctx.strokeStyle = '#8a5a28'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(PVX, PVY); ctx.lineTo(cupX, cupY); ctx.stroke();
            ctx.lineCap = 'butt';

            // ── roca en vuelo impactando la torre B + estela ──
            ctx.strokeStyle = 'rgba(255,200,90,0.55)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(96, 118); ctx.lineTo(132, 128); ctx.stroke();
            function boulder(bx2, by2, r) {
                var prg = ctx.createRadialGradient(bx2 - r * 0.35, by2 - r * 0.35, 1, bx2, by2, r);
                prg.addColorStop(0, '#cfc3a4'); prg.addColorStop(0.55, '#8a7a66'); prg.addColorStop(1, '#41382e');
                ctx.fillStyle = prg; ctx.beginPath(); ctx.arc(bx2, by2, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1; ctx.stroke();
            }
            boulder(cupX, cupY - 4, 8);   // roca lista en la cuchara
            boulder(140, 130, 8);          // roca en vuelo

            // ── trayectoria punteada hacia las torres ──
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            var arcPts = [[60, 132], [80, 116], [102, 106], [124, 104], [146, 112]];
            arcPts.forEach(function (p) {
                ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, Math.PI * 2); ctx.fill();
            });

            // ── explosión / escombros en el impacto ──
            var EX = 150, EY = 130;
            for (var p = 0; p < 14; p++) {
                var ang = p * (Math.PI * 2 / 14);
                var rr  = 9 + (p % 3) * 4;
                ctx.fillStyle = (p % 2 === 0) ? '#ffd866' : '#ff6b4a';
                ctx.fillRect(EX + Math.cos(ang) * rr - 1, EY + Math.sin(ang) * rr - 1, 2, 2);
            }

            // ── HUD: nivel, munición y viento ──
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Nv 2  Pts 340', 6, 11);
            // munición (puntos de roca)
            for (var a = 0; a < 4; a++) {
                ctx.fillStyle = a < 3 ? '#cdbb98' : 'rgba(255,255,255,0.2)';
                ctx.beginPath(); ctx.arc(116 + a * 11, 11, 3.5, 0, Math.PI * 2); ctx.fill();
            }
            // flecha de viento
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(170, 11); ctx.lineTo(196, 11); ctx.stroke();
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath(); ctx.moveTo(196, 11); ctx.lineTo(191, 7); ctx.lineTo(191, 15); ctx.closePath(); ctx.fill();
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['catapulta'] = draw;
}());

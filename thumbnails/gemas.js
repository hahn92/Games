/* Miniatura de gemas para el catálogo. La carga thumbnails.js bajo demanda,
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
            // fondo oscuro con tinte violeta
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#140a2a');
            bg.addColorStop(1, '#05061a');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            // estrellitas de fondo
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            var starsG = [[14,22],[48,12],[96,30],[150,18],[195,42],[28,70],
                          [88,90],[172,86],[210,14],[18,160],[200,195],[120,210]];
            for (var si = 0; si < starsG.length; si++) {
                ctx.fillRect(starsG[si][0], starsG[si][1], 2, 2);
            }

            // paleta
            var GC = [
                { base:'#ff4757', light:'#ffa0a7', dark:'#7a1a21' }, // rojo rombo
                { base:'#3fa9ff', light:'#8fd0ff', dark:'#0f3f77' }, // azul círculo
                { base:'#2ecc71', light:'#8fe3b2', dark:'#155e34' }, // verde triángulo
                { base:'#ffd93d', light:'#ffee99', dark:'#8a6b00' }, // amar hexágono
                { base:'#c66cff', light:'#e4b2ff', dark:'#5b1f8a' }, // púrp estrella
                { base:'#ff9f43', light:'#ffc98a', dark:'#8a4e0f' }  // naranj cuadrado
            ];

            function pathGemMini(type, r) {
                ctx.beginPath();
                if (type === 0) {
                    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
                } else if (type === 1) {
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                } else if (type === 2) {
                    ctx.moveTo(0, -r);
                    ctx.lineTo(r * 0.92, r * 0.72);
                    ctx.lineTo(-r * 0.92, r * 0.72); ctx.closePath();
                } else if (type === 3) {
                    for (var i = 0; i < 6; i++) {
                        var a = Math.PI / 3 * i - Math.PI / 2;
                        var px = Math.cos(a) * r, py = Math.sin(a) * r;
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                } else if (type === 4) {
                    for (var j = 0; j < 10; j++) {
                        var ra = (j % 2 === 0) ? r : r * 0.48;
                        var ang = (Math.PI / 5) * j - Math.PI / 2;
                        var x2 = Math.cos(ang) * ra, y2 = Math.sin(ang) * ra;
                        if (j === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
                    }
                    ctx.closePath();
                } else {
                    var sr = r * 0.88, rd = 3;
                    ctx.moveTo(-sr + rd, -sr);
                    ctx.lineTo(sr - rd, -sr);
                    ctx.quadraticCurveTo(sr, -sr, sr, -sr + rd);
                    ctx.lineTo(sr, sr - rd);
                    ctx.quadraticCurveTo(sr, sr, sr - rd, sr);
                    ctx.lineTo(-sr + rd, sr);
                    ctx.quadraticCurveTo(-sr, sr, -sr, sr - rd);
                    ctx.lineTo(-sr, -sr + rd);
                    ctx.quadraticCurveTo(-sr, -sr, -sr + rd, -sr);
                    ctx.closePath();
                }
            }

            function drawMini(cx, cy, type, r) {
                // sombra
                ctx.fillStyle = 'rgba(0,0,0,0.28)';
                ctx.beginPath();
                ctx.ellipse(cx + 1, cy + r * 0.6, r * 0.75, r * 0.2, 0, 0, Math.PI * 2);
                ctx.fill();
                // gradiente radial inline
                var col = GC[type];
                var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r);
                g.addColorStop(0, col.light);
                g.addColorStop(0.55, col.base);
                g.addColorStop(1, col.dark);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.fillStyle = g;
                pathGemMini(type, r);
                ctx.fill();
                ctx.strokeStyle = col.dark;
                ctx.lineWidth = 1;
                pathGemMini(type, r);
                ctx.stroke();
                // especular
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.12, -0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // tablero 5 cols x 5 filas centrado
            var gridN = 5;
            var cellG = 38;
            var gridW = gridN * cellG;
            var gridOx = (W - gridW) / 2;
            var gridOy = 42;
            // marco del tablero
            ctx.fillStyle = 'rgba(10,6,28,0.65)';
            ctx.fillRect(gridOx - 4, gridOy - 4, gridW + 8, gridN * cellG + 8);
            ctx.strokeStyle = 'rgba(143,211,244,0.45)';
            ctx.lineWidth = 2;
            ctx.strokeRect(gridOx - 4, gridOy - 4, gridW + 8, gridN * cellG + 8);
            // grid tenue
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            for (var gg = 1; gg < gridN; gg++) {
                ctx.beginPath(); ctx.moveTo(gridOx + gg * cellG, gridOy); ctx.lineTo(gridOx + gg * cellG, gridOy + gridN * cellG); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(gridOx, gridOy + gg * cellG); ctx.lineTo(gridOx + gridN * cellG, gridOy + gg * cellG); ctx.stroke();
            }

            // patrón con una fila de match de 3 rojos (resaltada)
            var layout = [
                [1, 4, 2, 3, 5],
                [0, 0, 0, 3, 2], // triple rojo en la segunda fila
                [4, 1, 5, 2, 0],
                [3, 2, 4, 1, 5],
                [5, 3, 1, 4, 2]
            ];

            // halo del match
            ctx.fillStyle = 'rgba(255,71,87,0.22)';
            ctx.fillRect(gridOx, gridOy + cellG, cellG * 3, cellG);

            var gemR = cellG * 0.38;
            for (var rr = 0; rr < gridN; rr++) {
                for (var cc = 0; cc < gridN; cc++) {
                    var cx = gridOx + cc * cellG + cellG / 2;
                    var cy = gridOy + rr * cellG + cellG / 2;
                    drawMini(cx, cy, layout[rr][cc], gemR);
                }
            }

            // marcador de selección (gema elegida lista para intercambio)
            ctx.strokeStyle = '#ffd93d';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(gridOx + 0 * cellG + 3, gridOy + 1 * cellG + 3, cellG - 6, cellG - 6);

            // chispitas del match
            var sparks = [
                {x: gridOx + 0.5 * cellG, y: gridOy + 1.5 * cellG, s: 3, a: 0.9, col: '#ff4757'},
                {x: gridOx + 1.5 * cellG, y: gridOy + 1.5 * cellG, s: 3, a: 0.9, col: '#fff'},
                {x: gridOx + 2.5 * cellG, y: gridOy + 1.5 * cellG, s: 3, a: 0.9, col: '#ff4757'},
                {x: gridOx + 1.0 * cellG, y: gridOy + 0.5 * cellG, s: 2, a: 0.7, col: '#ffd93d'},
                {x: gridOx + 2.0 * cellG, y: gridOy + 2.3 * cellG, s: 2, a: 0.7, col: '#ffd93d'}
            ];
            for (var sp = 0; sp < sparks.length; sp++) {
                var sk = sparks[sp];
                ctx.globalAlpha = sk.a;
                ctx.fillStyle = sk.col;
                ctx.fillRect(sk.x - sk.s / 2, sk.y - sk.s / 2, sk.s, sk.s);
            }
            ctx.globalAlpha = 1;

            // texto título
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText('GEMAS', W / 2, 26);

            // combo message
            ctx.fillStyle = '#ffd93d';
            ctx.font = 'bold 13px Segoe UI, Arial, sans-serif';
            ctx.fillText('¡COMBO x3!', W / 2, gridOy + gridN * cellG + 22);
        };

    (window.__thumbs = window.__thumbs || {})['gemas'] = draw;
}());

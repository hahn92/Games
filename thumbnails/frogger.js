/* Miniatura de frogger para el catálogo. La carga thumbnails.js bajo demanda,
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
            /* ── helpers ── */
            function drawLog(lx, ly, lw, lh) {
                // body with cylindrical gradient
                var lg = ctx.createLinearGradient(lx, ly, lx, ly + lh);
                lg.addColorStop(0, '#c8855a');
                lg.addColorStop(0.35, '#a0612a');
                lg.addColorStop(0.65, '#7a4520');
                lg.addColorStop(1, '#5c3010');
                roundRect(ctx, lx, ly, lw, lh, lh / 2, lg);
                // wood grain lines
                ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([]);
                for (var gi = 14; gi < lw - 6; gi += 14) {
                    ctx.beginPath();
                    ctx.moveTo(lx + gi, ly + 3);
                    ctx.lineTo(lx + gi, ly + lh - 3);
                    ctx.stroke();
                }
                // top highlight
                ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(lx + lh / 2 + 2, ly + 3);
                ctx.lineTo(lx + lw - lh / 2 - 2, ly + 3);
                ctx.stroke();
                // end cap left
                var el = ctx.createRadialGradient(lx + lh/2, ly + lh/2, 1, lx + lh/2, ly + lh/2, lh/2);
                el.addColorStop(0, '#d49060'); el.addColorStop(1, '#6b3d18');
                ctx.fillStyle = el;
                ctx.beginPath(); ctx.ellipse(lx + lh/2, ly + lh/2, lh/2, lh/2, 0, 0, Math.PI*2); ctx.fill();
                // end cap right
                var er = ctx.createRadialGradient(lx + lw - lh/2, ly + lh/2, 1, lx + lw - lh/2, ly + lh/2, lh/2);
                er.addColorStop(0, '#d49060'); er.addColorStop(1, '#6b3d18');
                ctx.fillStyle = er;
                ctx.beginPath(); ctx.ellipse(lx + lw - lh/2, ly + lh/2, lh/2, lh/2, 0, 0, Math.PI*2); ctx.fill();
            }

            function drawCar(cx, cy, cw, ch, col, dir) {
                // shadow
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath(); ctx.ellipse(cx + cw/2, cy + ch + 3, cw*0.45, 4, 0, 0, Math.PI*2); ctx.fill();
                // body gradient
                var bg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
                bg.addColorStop(0, lighten(col, 40));
                bg.addColorStop(0.4, col);
                bg.addColorStop(1, darken(col, 40));
                roundRect(ctx, cx, cy, cw, ch, 5, bg);
                // roof (trapezoid)
                var rInset = 8, rH = Math.round(ch * 0.45);
                ctx.fillStyle = darken(col, 20);
                ctx.beginPath();
                ctx.moveTo(cx + rInset, cy);
                ctx.lineTo(cx + cw - rInset, cy);
                ctx.lineTo(cx + cw - rInset - 4, cy - rH);
                ctx.lineTo(cx + rInset + 4, cy - rH);
                ctx.closePath(); ctx.fill();
                // windshield
                ctx.fillStyle = 'rgba(160,220,255,0.75)';
                ctx.beginPath();
                ctx.moveTo(cx + rInset + 1, cy - 1);
                ctx.lineTo(cx + cw - rInset - 1, cy - 1);
                ctx.lineTo(cx + cw - rInset - 5, cy - rH + 2);
                ctx.lineTo(cx + rInset + 5, cy - rH + 2);
                ctx.closePath(); ctx.fill();
                // wheels
                [cx + 7, cx + cw - 7].forEach(function(wx){
                    var wg = ctx.createRadialGradient(wx, cy+ch, 0, wx, cy+ch, 6);
                    wg.addColorStop(0, '#555'); wg.addColorStop(0.5, '#222'); wg.addColorStop(1, '#000');
                    ctx.fillStyle = wg;
                    ctx.beginPath(); ctx.arc(wx, cy + ch, 6, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#888';
                    ctx.beginPath(); ctx.arc(wx, cy + ch, 2.5, 0, Math.PI*2); ctx.fill();
                });
                // headlights
                ctx.fillStyle = dir > 0 ? '#fff9c4' : '#ffccbc';
                ctx.beginPath(); ctx.ellipse(cx + (dir > 0 ? cw - 3 : 3), cy + ch/2, 3, 4, 0, 0, Math.PI*2); ctx.fill();
            }

            function lighten(hex, amt) {
                var n = parseInt(hex.slice(1), 16);
                var r = Math.min(255, (n>>16) + amt);
                var g = Math.min(255, ((n>>8)&0xff) + amt);
                var b = Math.min(255, (n&0xff) + amt);
                return 'rgb('+r+','+g+','+b+')';
            }
            function darken(hex, amt) { return lighten(hex, -amt); }

            function drawFrog(fx, fy, scale) {
                var s = scale || 1;
                ctx.save(); ctx.translate(fx, fy); ctx.scale(s, s);
                // shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(0, 14, 14, 5, 0, 0, Math.PI*2); ctx.fill();
                // back legs
                ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(-8, 6); ctx.quadraticCurveTo(-22, 8, -20, 18); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(8, 6); ctx.quadraticCurveTo(22, 8, 20, 18); ctx.stroke();
                // body
                var bodyG = ctx.createRadialGradient(-3, -4, 1, 0, 0, 14);
                bodyG.addColorStop(0, '#a9e34b');
                bodyG.addColorStop(0.5, '#69db7c');
                bodyG.addColorStop(1, '#2f9e44');
                ctx.fillStyle = bodyG;
                ctx.beginPath(); ctx.ellipse(0, 2, 13, 11, 0, 0, Math.PI*2); ctx.fill();
                // belly stripe
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath(); ctx.ellipse(0, 5, 7, 5, 0, 0, Math.PI*2); ctx.fill();
                // head
                var headG = ctx.createRadialGradient(-2, -12, 1, 0, -11, 9);
                headG.addColorStop(0, '#b2f2bb');
                headG.addColorStop(1, '#2f9e44');
                ctx.fillStyle = headG;
                ctx.beginPath(); ctx.ellipse(0, -10, 9, 8, 0, 0, Math.PI*2); ctx.fill();
                // front legs
                ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-18, 4, -17, 12); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(9, 2); ctx.quadraticCurveTo(18, 4, 17, 12); ctx.stroke();
                // eyes (bulging)
                [[-6,-16],[6,-16]].forEach(function(e){
                    // eye socket
                    var eg = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], 5);
                    eg.addColorStop(0, '#c8ffa0'); eg.addColorStop(1, '#2f9e44');
                    ctx.fillStyle = eg;
                    ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, Math.PI*2); ctx.fill();
                    // pupil
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath(); ctx.arc(e[0]+0.5, e[1]+0.5, 2.5, 0, Math.PI*2); ctx.fill();
                    // highlight
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(e[0]+1, e[1]-1, 1, 0, Math.PI*2); ctx.fill();
                });
                // mouth
                ctx.strokeStyle = '#1a6b2a'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(0, -8, 4, 0.1, Math.PI - 0.1); ctx.stroke();
                ctx.restore();
            }

            /* ── background zones ── */
            // sky / top safe zone
            var skyG = ctx.createLinearGradient(0, 0, 0, 28);
            skyG.addColorStop(0, '#1b5e20'); skyG.addColorStop(1, '#2e7d32');
            ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, 28);
            // grass texture dots
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            for (var gi2 = 0; gi2 < 20; gi2++) {
                ctx.fillRect(gi2 * 11 + 4, 8, 3, 6);
            }

            // river
            var riverG = ctx.createLinearGradient(0, 28, 0, 132);
            riverG.addColorStop(0, '#0d47a1');
            riverG.addColorStop(0.5, '#1565c0');
            riverG.addColorStop(1, '#0d47a1');
            ctx.fillStyle = riverG; ctx.fillRect(0, 28, W, 104);
            // water shimmer lines
            ctx.strokeStyle = 'rgba(144,202,249,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([20, 30]);
            [45, 72, 100].forEach(function(wy){
                ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(W, wy); ctx.stroke();
            });
            ctx.setLineDash([]);

            // road
            var roadG = ctx.createLinearGradient(0, 132, 0, 200);
            roadG.addColorStop(0, '#37474f');
            roadG.addColorStop(1, '#263238');
            ctx.fillStyle = roadG; ctx.fillRect(0, 132, W, 68);
            // kerb lines (top/bottom of road)
            ctx.fillStyle = '#e0e0e0';
            ctx.fillRect(0, 132, W, 3);
            ctx.fillRect(0, 197, W, 3);
            // lane dashes
            ctx.strokeStyle = '#ffee58'; ctx.lineWidth = 2; ctx.setLineDash([18, 14]);
            [149, 166, 183].forEach(function(ly){
                ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
            });
            ctx.setLineDash([]);

            // bottom safe zone
            var grassG = ctx.createLinearGradient(0, 200, 0, H);
            grassG.addColorStop(0, '#2e7d32'); grassG.addColorStop(1, '#1b5e20');
            ctx.fillStyle = grassG; ctx.fillRect(0, 200, W, H - 200);

            /* ── lily pads (goal) ── */
            [18, 55, 91, 127, 163].forEach(function(lx){
                var lpG = ctx.createRadialGradient(lx + 10, 14, 1, lx + 10, 16, 11);
                lpG.addColorStop(0, '#69db7c'); lpG.addColorStop(1, '#1b5e20');
                ctx.fillStyle = lpG;
                ctx.beginPath(); ctx.ellipse(lx + 10, 16, 11, 7, 0, 0, Math.PI*2); ctx.fill();
                // notch
                ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(lx + 10, 16); ctx.lineTo(lx + 10, 9); ctx.stroke();
            });

            /* ── logs ── */
            drawLog(-5, 34, 88, 20);
            drawLog(105, 34, 90, 20);
            drawLog(5, 60, 75, 20);
            drawLog(108, 60, 82, 20);
            drawLog(-5, 86, 95, 20);
            drawLog(108, 86, 78, 20);

            /* ── cars ── */
            drawCar(8,  152, 50, 18, '#e53935', -1);
            drawCar(128,152, 50, 18, '#1e88e5',  1);
            drawCar(55, 168, 56, 18, '#fdd835', -1);
            drawCar(140,168, 44, 18, '#7b1fa2',  1);
            drawCar(12, 184, 42, 16, '#ef6c00', -1);

            /* ── frog (center, on a log) ── */
            drawFrog(52, 65, 1.05);
        };

    (window.__thumbs = window.__thumbs || {})['frogger'] = draw;
}());

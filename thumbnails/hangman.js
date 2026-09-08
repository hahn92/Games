/* Miniatura de hangman para el catálogo. La carga thumbnails.js bajo demanda,
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
            var bgG = ctx.createLinearGradient(0,0,W,H);
            bgG.addColorStop(0,'#0f1a0f'); bgG.addColorStop(1,'#1a1a2a');
            ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

            // gallows
            ctx.strokeStyle = '#8fd3f4'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(25,205); ctx.lineTo(125,205); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(65,205); ctx.lineTo(65,20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(65,20); ctx.lineTo(155,20); ctx.stroke();
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(65,48); ctx.lineTo(96,20); ctx.stroke();
            ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(155,20); ctx.lineTo(155,38); ctx.stroke();

            // stick figure (5 of 6 parts)
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(155,52,13,0,Math.PI*2); ctx.stroke();
            // sad face
            ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(149,48); ctx.lineTo(152,51); ctx.moveTo(152,48); ctx.lineTo(149,51); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(157,48); ctx.lineTo(160,51); ctx.moveTo(160,48); ctx.lineTo(157,51); ctx.stroke();
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(155,65); ctx.lineTo(155,112); ctx.stroke(); // body
            ctx.beginPath(); ctx.moveTo(155,76); ctx.lineTo(133,98); ctx.stroke();  // left arm
            ctx.beginPath(); ctx.moveTo(155,76); ctx.lineTo(177,98); ctx.stroke();  // right arm
            ctx.beginPath(); ctx.moveTo(155,112); ctx.lineTo(134,146); ctx.stroke(); // left leg

            // word blanks — _ A _ I M _
            var letters = ['','A','','I','M',''];
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            letters.forEach(function(l, i) {
                var lx = 12 + i*32, ly = 182;
                ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(lx+2,ly+3); ctx.lineTo(lx+26,ly+3); ctx.stroke();
                if (l) {
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
                    ctx.fillText(l, lx+14, ly);
                }
            });

            // wrong letters
            ctx.fillStyle = '#e53935'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
            ['E','O','S','R'].forEach(function(l,i){ ctx.fillText(l, 10+i*16, 210); });

            ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
            ctx.fillText('60 pts', W-8, 12); ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['hangman'] = draw;
}());

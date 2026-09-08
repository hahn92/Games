/* Miniatura de canastas para el catálogo. La carga thumbnails.js bajo demanda,
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
            var bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#16233c'); bg.addColorStop(1, '#0a1120');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            ctx.fillStyle = '#1d2a44'; ctx.fillRect(0, 190, W, 30);
            ctx.strokeStyle = 'rgba(143,211,244,0.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 190); ctx.lineTo(W, 190); ctx.stroke();

            /* tablero y aro */
            var bx = 176, rimY = 78, rimX = 148, half = 22;
            ctx.fillStyle = '#e8eef7'; ctx.fillRect(bx, rimY - 52, 7, 60);
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 3;
            ctx.strokeRect(bx - 24, rimY - 34, 24, 28);
            ctx.fillStyle = '#4a5570'; ctx.fillRect(bx + 7, rimY - 22, W - bx - 7, 5);
            ctx.strokeStyle = '#ff512f'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(rimX - half, rimY); ctx.lineTo(rimX + half, rimY); ctx.stroke();
            ctx.fillStyle = '#ff7a52';
            ctx.beginPath(); ctx.arc(rimX - half, rimY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(rimX + half, rimY, 4, 0, Math.PI * 2); ctx.fill();
            /* red */
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (var i = 0; i <= 5; i++) {
                var t = i / 5;
                ctx.moveTo(rimX - half + t * half * 2, rimY);
                ctx.lineTo(rimX - half * 0.55 + t * half * 1.1, rimY + 24);
            }
            ctx.moveTo(rimX - half * 0.85, rimY + 10); ctx.lineTo(rimX + half * 0.85, rimY + 10);
            ctx.stroke();

            /* trayectoria punteada */
            ctx.strokeStyle = 'rgba(255,213,74,0.6)'; ctx.lineWidth = 2;
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.moveTo(40, 170);
            ctx.quadraticCurveTo(96, 8, rimX, rimY + 4);
            ctx.stroke();
            ctx.setLineDash([]);

            /* balón */
            var g = ctx.createRadialGradient(36, 164, 3, 40, 170, 15);
            g.addColorStop(0, '#ffb066'); g.addColorStop(1, '#d2691e');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(40, 170, 15, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#5c2f0d'; ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(25, 170); ctx.lineTo(55, 170);
            ctx.moveTo(40, 155); ctx.lineTo(40, 185);
            ctx.stroke();
            ctx.beginPath(); ctx.ellipse(40, 170, 8, 15, 0, 0, Math.PI * 2); ctx.stroke();

            ctx.fillStyle = '#ffb066';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('CANASTAS', W / 2, 210);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['canastas'] = draw;
}());

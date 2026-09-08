/* Miniatura de escaleras para el catálogo. La carga thumbnails.js bajo demanda,
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
            bg.addColorStop(0, '#16351f'); bg.addColorStop(1, '#081208');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
            var n = 6, m = W * 0.84, s = m / n, ox = (W - m) / 2, oy = 16;
            for (var r = 0; r < n; r++) {
                for (var c = 0; c < n; c++) {
                    ctx.fillStyle = (r + c) % 2 ? '#173626' : '#1c4433';
                    ctx.fillRect(ox + c * s, oy + r * s, s + 0.5, s + 0.5);
                }
            }
            // una escalera
            var a = { x: ox + s * 0.5, y: oy + s * 5.5 }, b = { x: ox + s * 2.5, y: oy + s * 2.5 };
            var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
            var nx = -dy / len * 7, ny = dx / len * 7;
            ctx.strokeStyle = '#c58a3a'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
            ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(b.x - nx, b.y - ny);
            ctx.stroke();
            ctx.strokeStyle = '#e0a856'; ctx.lineWidth = 3;
            ctx.beginPath();
            for (var k = 1; k < 5; k++) {
                var t = k / 5, mx = a.x + dx * t, my = a.y + dy * t;
                ctx.moveTo(mx + nx, my + ny); ctx.lineTo(mx - nx, my - ny);
            }
            ctx.stroke();
            // una serpiente
            var h = { x: ox + s * 4.5, y: oy + s * 1.5 }, tl = { x: ox + s * 5.5, y: oy + s * 4.5 };
            ctx.strokeStyle = '#7fbf4d'; ctx.lineWidth = 10; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(h.x, h.y);
            ctx.bezierCurveTo(h.x + 34, h.y + 22, tl.x - 40, tl.y - 24, tl.x, tl.y);
            ctx.stroke();
            ctx.fillStyle = '#5f9e34';
            ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0d1a0a';
            ctx.beginPath();
            ctx.arc(h.x - 3, h.y - 3, 2, 0, Math.PI * 2);
            ctx.arc(h.x + 4, h.y - 3, 2, 0, Math.PI * 2);
            ctx.fill();
            // fichas y dado
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath(); ctx.arc(ox + s * 1.5, oy + s * 5.5, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff8a3d';
            ctx.beginPath(); ctx.arc(ox + s * 3.5, oy + s * 3.5, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f7f3e8';
            ctx.beginPath(); ctx.roundRect(W / 2 - 16, H - 44, 32, 32, 7); ctx.fill();
            ctx.fillStyle = '#26221c';
            [[0.3,0.3],[0.5,0.5],[0.7,0.7]].forEach(function (p) {
                ctx.beginPath();
                ctx.arc(W / 2 - 16 + p[0] * 32, H - 44 + p[1] * 32, 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = '#cfe0f5'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.fillText('SERPIENTES', W / 2, H - 4);
            ctx.textAlign = 'left';
        };

    (window.__thumbs = window.__thumbs || {})['escaleras'] = draw;
}());

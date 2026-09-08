/* Miniatura de minero para el catálogo. La carga thumbnails.js bajo demanda,
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
            // cielo
            var gSky = ctx.createLinearGradient(0, 0, 0, 90);
            gSky.addColorStop(0, '#0f1f44');
            gSky.addColorStop(1, '#3d5d99');
            ctx.fillStyle = gSky;
            ctx.fillRect(0, 0, W, 90);
            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            for (var ms = 0; ms < 14; ms++) {
                var sx = (ms * 31) % W;
                var sy = (ms * 19) % 70 + 4;
                ctx.fillRect(sx, sy, 1, 1);
            }
            // luna
            ctx.fillStyle = '#fbe89d';
            ctx.beginPath(); ctx.arc(W - 30, 28, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0f1f44';
            ctx.beginPath(); ctx.arc(W - 26, 24, 9, 0, Math.PI * 2); ctx.fill();

            // tierra
            var gDirt = ctx.createLinearGradient(0, 90, 0, H);
            gDirt.addColorStop(0, '#6a3d1e');
            gDirt.addColorStop(0.15, '#4a2a12');
            gDirt.addColorStop(1, '#1a0f08');
            ctx.fillStyle = gDirt;
            ctx.fillRect(0, 90, W, H - 90);
            // hierba
            ctx.fillStyle = '#3d7a2e'; ctx.fillRect(0, 86, W, 5);
            ctx.fillStyle = '#2d5a1f';
            for (var gg = 0; gg < W; gg += 7) ctx.fillRect(gg, 84, 2, 3);
            // granitos
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            for (var di = 0; di < 24; di++) {
                var ddx = (di * 43 + 7) % W;
                var ddy = 100 + (di * 61) % (H - 110);
                ctx.fillRect(ddx, ddy, 2, 2);
            }

            // plataforma
            var mxM = W / 2;
            ctx.fillStyle = '#8a6138';
            ctx.fillRect(mxM - 42, 82, 84, 5);
            // mástil polea
            ctx.fillStyle = '#b59264';
            ctx.fillRect(mxM - 3, 28, 6, 36);
            // polea
            ctx.fillStyle = '#2a1c0a';
            ctx.beginPath(); ctx.arc(mxM, 62, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8a6138';
            ctx.beginPath(); ctx.arc(mxM, 62, 7, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#2a1c0a'; ctx.lineWidth = 1.5;
            for (var sp = 0; sp < 4; sp++) {
                var aa = sp * Math.PI / 2 + 0.4;
                ctx.beginPath();
                ctx.moveTo(mxM, 62);
                ctx.lineTo(mxM + Math.cos(aa) * 6, 62 + Math.sin(aa) * 6);
                ctx.stroke();
            }

            // minero
            var mmx = mxM + 28, mmy = 36;
            // torso
            ctx.fillStyle = '#c94b3a'; ctx.fillRect(mmx - 8, mmy + 14, 16, 17);
            // cinturón
            ctx.fillStyle = '#3a2a18'; ctx.fillRect(mmx - 8, mmy + 28, 16, 3);
            // brazos
            ctx.fillStyle = '#c94b3a';
            ctx.fillRect(mmx - 14, mmy + 16, 6, 5);
            ctx.fillRect(mmx + 8, mmy + 16, 6, 5);
            // cabeza
            ctx.fillStyle = '#f5c29a';
            ctx.beginPath(); ctx.arc(mmx, mmy + 8, 7, 0, Math.PI * 2); ctx.fill();
            // bigote
            ctx.fillStyle = '#3a2a18'; ctx.fillRect(mmx - 4, mmy + 10, 8, 1.5);
            // casco
            ctx.fillStyle = '#e6b800';
            ctx.beginPath(); ctx.arc(mmx, mmy + 5, 7.5, Math.PI, 0); ctx.fill();
            ctx.fillRect(mmx - 9, mmy + 4, 18, 3);
            ctx.fillStyle = '#b38c00'; ctx.fillRect(mmx - 9, mmy + 6, 18, 1);
            ctx.fillStyle = '#fff7a0'; ctx.fillRect(mmx - 2, mmy + 2, 4, 2.5);
            // piernas
            ctx.fillStyle = '#2a3748';
            ctx.fillRect(mmx - 7, mmy + 31, 6, 8);
            ctx.fillRect(mmx + 1, mmy + 31, 6, 8);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(mmx - 8, mmy + 37, 7, 3);
            ctx.fillRect(mmx + 1, mmy + 37, 7, 3);

            // rope + hook going into the mine
            var tipX = mxM - 50, tipY = 172;
            ctx.strokeStyle = '#d8b070'; ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(mxM, 62);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();
            // gancho
            ctx.save();
            ctx.translate(tipX, tipY);
            var ang = Math.atan2(tipY - 62, tipX - mxM) - Math.PI / 2;
            ctx.rotate(ang);
            ctx.fillStyle = '#b0b0b0'; ctx.fillRect(-2, -6, 4, 6);
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0, -8, 3, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#e4e4e4'; ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-5, -1); ctx.quadraticCurveTo(-6, 8, 0, 8);
            ctx.moveTo(5, -1);  ctx.quadraticCurveTo(6, 8, 0, 8);
            ctx.stroke();
            ctx.lineCap = 'butt';
            ctx.restore();

            // objetos en la mina
            // pepita grande enganchada cerca del tip
            var nugX = tipX, nugY = tipY + 14;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(nugX + 2, nugY + 16, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
            var gN = ctx.createRadialGradient(nugX - 6, nugY - 6, 3, nugX, nugY, 16);
            gN.addColorStop(0, '#fff3a8'); gN.addColorStop(0.5, '#f5c542'); gN.addColorStop(1, '#9e7518');
            ctx.fillStyle = gN;
            ctx.beginPath();
            var nSides = 8;
            for (var ni = 0; ni < nSides; ni++) {
                var na = ni / nSides * Math.PI * 2;
                var nr = 14 * (0.85 + 0.18 * Math.sin(ni * 3.1));
                var npx = nugX + Math.cos(na) * nr;
                var npy = nugY + Math.sin(na) * nr;
                if (ni === 0) ctx.moveTo(npx, npy); else ctx.lineTo(npx, npy);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#6b4a12'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.ellipse(nugX - 5, nugY - 5, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();

            // diamante abajo derecha
            var dx0 = W - 42, dy0 = H - 36, dr = 14;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(dx0 + 2, dy0 + 16, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
            var gD = ctx.createLinearGradient(dx0 - dr, dy0 - dr, dx0 + dr, dy0 + dr);
            gD.addColorStop(0, '#e4faff'); gD.addColorStop(0.5, '#58c7ff'); gD.addColorStop(1, '#1f6fa0');
            ctx.fillStyle = gD;
            ctx.beginPath();
            ctx.moveTo(dx0, dy0 + dr);
            ctx.lineTo(dx0 + dr, dy0);
            ctx.lineTo(dx0, dy0 - dr);
            ctx.lineTo(dx0 - dr, dy0);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dx0 - dr, dy0); ctx.lineTo(dx0 + dr, dy0);
            ctx.moveTo(dx0, dy0 - dr); ctx.lineTo(dx0, dy0 + dr);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.fillRect(dx0 - 1, dy0 - dr + 2, 2, 4);

            // roca abajo izquierda
            var rx0 = 38, ry0 = H - 40, rr0 = 16;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(rx0 + 2, ry0 + 17, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
            var gR = ctx.createRadialGradient(rx0 - 5, ry0 - 5, 3, rx0, ry0, rr0);
            gR.addColorStop(0, '#bdb6ae'); gR.addColorStop(1, '#3f3a34');
            ctx.fillStyle = gR;
            ctx.beginPath();
            var rSides = 10;
            for (var ri = 0; ri < rSides; ri++) {
                var ra = ri / rSides * Math.PI * 2;
                var rrr = rr0 * (0.85 + 0.2 * Math.sin(ri * 2.3 + 0.7));
                var rpx = rx0 + Math.cos(ra) * rrr;
                var rpy = ry0 + Math.sin(ra) * rrr;
                if (ri === 0) ctx.moveTo(rpx, rpy); else ctx.lineTo(rpx, rpy);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 1; ctx.stroke();

            // destellos
            ctx.fillStyle = 'rgba(255,217,61,0.75)';
            ctx.fillRect(nugX - 18, nugY - 2, 2, 2);
            ctx.fillRect(nugX + 16, nugY + 4, 2, 2);
            ctx.fillStyle = 'rgba(143,211,244,0.75)';
            ctx.fillRect(dx0 - 20, dy0 - 3, 2, 2);
            ctx.fillRect(dx0 + 17, dy0 - 9, 2, 2);

            // título
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 20);
            ctx.fillStyle = '#ffd93d';
            ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('MINERO', W / 2, 11);
            ctx.textBaseline = 'alphabetic';
        };

    (window.__thumbs = window.__thumbs || {})['minero'] = draw;
}());

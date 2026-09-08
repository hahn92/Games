/* Miniatura de spaceinvaders para el catálogo. La carga thumbnails.js bajo demanda,
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
            background(ctx, '#000');
            // nebula glow in corner
            var nebG = ctx.createRadialGradient(30, 60, 0, 30, 60, 80);
            nebG.addColorStop(0, 'rgba(0,80,60,0.25)');
            nebG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = nebG; ctx.fillRect(0, 0, W, H);
            var nebG2 = ctx.createRadialGradient(200, 150, 0, 200, 150, 70);
            nebG2.addColorStop(0, 'rgba(30,0,80,0.2)');
            nebG2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = nebG2; ctx.fillRect(0, 0, W, H);
            // stars with varied sizes
            [[15,10,1],[50,25,2],[90,8,1],[130,18,2],[175,5,1],[200,30,1],[30,50,2],
             [80,45,1],[150,35,2],[210,20,1],[55,15,1],[100,5,2],[170,40,1],[10,35,1]].forEach(function(s){
                ctx.fillStyle = s[2]===2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // helper: draw alien body pixel then add gradient
            function drawAlienA(ax, ay, col, colDark) {
                // shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.ellipse(ax, ay+14, 14, 4, 0, 0, Math.PI*2); ctx.fill();
                // body with top-light gradient
                var ag = ctx.createLinearGradient(ax-12, ay, ax-12, ay+16);
                ag.addColorStop(0, col); ag.addColorStop(1, colDark);
                ctx.fillStyle = ag;
                ctx.fillRect(ax-10,ay,20,4);
                ctx.fillRect(ax-8,ay+4,16,8);
                ctx.fillRect(ax-12,ay+8,6,4);
                ctx.fillRect(ax+6,ay+8,6,4);
                ctx.fillRect(ax-6,ay+12,4,4);
                ctx.fillRect(ax+2,ay+12,4,4);
                // eyes white
                ctx.fillStyle = '#fff';
                ctx.fillRect(ax-5, ay+5, 3, 3);
                ctx.fillRect(ax+2, ay+5, 3, 3);
                // pupil
                ctx.fillStyle = '#000';
                ctx.fillRect(ax-4, ay+6, 2, 2);
                ctx.fillRect(ax+3, ay+6, 2, 2);
            }
            function drawAlienB(ax, ay, col, colDark) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.ellipse(ax, ay+14, 14, 4, 0, 0, Math.PI*2); ctx.fill();
                var ag = ctx.createLinearGradient(ax-12, ay, ax-12, ay+16);
                ag.addColorStop(0, col); ag.addColorStop(1, colDark);
                ctx.fillStyle = ag;
                ctx.fillRect(ax-8,ay,16,4);
                ctx.fillRect(ax-10,ay+4,20,8);
                ctx.fillRect(ax-12,ay+8,4,4);
                ctx.fillRect(ax+8,ay+8,4,4);
                ctx.fillRect(ax-4,ay+12,8,4);
                ctx.fillStyle = '#fff';
                ctx.fillRect(ax-4, ay+5, 3, 3);
                ctx.fillRect(ax+1, ay+5, 3, 3);
                ctx.fillStyle = '#000';
                ctx.fillRect(ax-3, ay+6, 2, 2);
                ctx.fillRect(ax+2, ay+6, 2, 2);
            }
            function drawAlienC(ax, ay, col, colDark) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath(); ctx.ellipse(ax, ay+14, 14, 4, 0, 0, Math.PI*2); ctx.fill();
                var ag = ctx.createLinearGradient(ax-14, ay, ax-14, ay+18);
                ag.addColorStop(0, col); ag.addColorStop(1, colDark);
                ctx.fillStyle = ag;
                ctx.fillRect(ax-10,ay+4,20,8);
                ctx.fillRect(ax-14,ay,4,8);
                ctx.fillRect(ax+10,ay,4,8);
                ctx.fillRect(ax-6,ay+12,4,6);
                ctx.fillRect(ax+2,ay+12,4,6);
                ctx.fillStyle = '#fff';
                ctx.fillRect(ax-4, ay+5, 3, 3);
                ctx.fillRect(ax+1, ay+5, 3, 3);
                ctx.fillStyle = '#000';
                ctx.fillRect(ax-3, ay+6, 2, 2);
                ctx.fillRect(ax+2, ay+6, 2, 2);
            }
            // row A — cyan
            [[40,30],[80,30],[120,30],[160,30],[200,30]].forEach(function(a){
                drawAlienA(a[0], a[1], '#00e5ff', '#006070');
            });
            // row B — magenta
            [[40,60],[80,60],[120,60],[160,60],[200,60]].forEach(function(a){
                drawAlienB(a[0], a[1], '#f48fb1', '#880044');
            });
            // row C — orange
            [[60,90],[120,90],[180,90]].forEach(function(a){
                drawAlienC(a[0], a[1], '#ffb74d', '#7a4000');
            });
            // bunkers with gradient green
            [35,82,130,178].forEach(function(bx){
                var bunG = ctx.createLinearGradient(bx, 158, bx, 180);
                bunG.addColorStop(0, '#66bb6a');
                bunG.addColorStop(1, '#2e7d32');
                roundRect(ctx, bx, 158, 28, 18, 3, bunG);
                // damage notches
                ctx.fillStyle = '#000';
                ctx.fillRect(bx+2, 168, 7, 8);
                ctx.fillRect(bx+19, 168, 7, 8);
            });
            // player ship
            var shipG = ctx.createLinearGradient(98, 184, 122, 200);
            shipG.addColorStop(0, '#b8e8ff');
            shipG.addColorStop(1, '#4a9fc8');
            ctx.fillStyle = shipG;
            ctx.fillRect(98, 192, 24, 8);
            ctx.fillRect(106, 184, 8, 10);
            // ship highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(100, 193, 8, 3);
            // bullet with glow
            var bulG = ctx.createRadialGradient(110, 148, 0, 110, 148, 5);
            bulG.addColorStop(0, '#fff');
            bulG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = bulG;
            ctx.fillRect(108, 140, 4, 18);
            ctx.fillStyle = '#fff';
            ctx.fillRect(109, 140, 2, 16);
        };

    (window.__thumbs = window.__thumbs || {})['spaceinvaders'] = draw;
}());

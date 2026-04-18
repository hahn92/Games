/* thumbnails.js — Canvas-drawn game thumbnails for the catalog.
 * Each function receives a CanvasRenderingContext2D and draws a
 * recognisable mini-scene for its game. No images needed.
 */
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

    /* ══════════════════════════════════════════════════════════════════ */

    var thumbs = {

        /* ── SNAKE ──────────────────────────────────────────────────── */
        snake: function (ctx) {
            // deep dark background with gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#071a0e');
            bgG.addColorStop(1, '#0d2b1a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            for (var i = 0; i <= W; i += 20) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
            }
            // snake body segments
            var seg = [
                [6,6],[5,6],[4,6],[3,6],[3,7],[3,8],[4,8],[5,8],[5,9],[5,10],
                [5,11],[4,11],[3,11],[2,11]
            ];
            seg.forEach(function (s, i) {
                var x = s[0]*20+1, y = s[1]*20+1, sz = 18, cx2 = x+sz/2, cy2 = y+sz/2;
                // drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath(); ctx.ellipse(cx2+1, cy2+3, sz*0.44, sz*0.28, 0, 0, Math.PI*2); ctx.fill();
                // segment gradient
                var g = ctx.createRadialGradient(cx2-3, cy2-3, 0, cx2, cy2, sz*0.72);
                g.addColorStop(0, i === 0 ? '#b2f2bb' : '#74c484');
                g.addColorStop(0.45, i === 0 ? '#69db7c' : '#2f9e44');
                g.addColorStop(1, i === 0 ? '#2f9e44' : '#145226');
                roundRect(ctx, x, y, sz, sz, 5, g);
                // border outline for volume
                ctx.strokeStyle = i === 0 ? 'rgba(100,255,130,0.5)' : 'rgba(30,120,60,0.4)';
                ctx.lineWidth = 1;
                roundRect(ctx, x, y, sz, sz, 5, null, i === 0 ? 'rgba(100,255,130,0.5)' : 'rgba(30,120,60,0.4)');
                // top highlight
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(x+3, y+3, sz-6, 4);
            });
            // head eye
            var hx = 6*20+1, hy = 6*20+1;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(hx+14, hy+7, 3.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(hx+15, hy+7, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(hx+15.5, hy+6.5, 0.8, 0, Math.PI*2); ctx.fill();
            // apple shadow
            var ax = 9*20+10, ay = 3*20+10;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(ax+1, ay+6, 7, 3.5, 0, 0, Math.PI*2); ctx.fill();
            // apple radial gradient
            var ag = ctx.createRadialGradient(ax-3, ay-3, 0, ax, ay, 10);
            ag.addColorStop(0, '#ff8a80');
            ag.addColorStop(0.45, '#e53935');
            ag.addColorStop(1, '#7f0000');
            ctx.fillStyle = ag;
            ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI*2); ctx.fill();
            // apple highlight
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath(); ctx.ellipse(ax-3, ay-3, 3, 2, -0.5, 0, Math.PI*2); ctx.fill();
            // stem
            ctx.strokeStyle = '#40c057'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax+1, ay-9); ctx.quadraticCurveTo(ax+5, ay-14, ax+4, ay-13); ctx.stroke();
            // leaf
            ctx.fillStyle = '#40c057';
            ctx.beginPath(); ctx.ellipse(ax+5, ay-12, 4, 2, -0.8, 0, Math.PI*2); ctx.fill();
        },

        /* ── TETRIS ─────────────────────────────────────────────────── */
        tetris: function (ctx) {
            background(ctx, '#0a0a0f');
            // subtle grid lines
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            var bw = 20, bh = 18, ox = 10, oy = 2;
            for (var gi = 0; gi <= 10; gi++) {
                ctx.beginPath(); ctx.moveTo(ox+gi*bw, oy); ctx.lineTo(ox+gi*bw, oy+12*bh); ctx.stroke();
            }
            for (var gr = 0; gr <= 12; gr++) {
                ctx.beginPath(); ctx.moveTo(ox, oy+gr*bh); ctx.lineTo(ox+10*bw, oy+gr*bh); ctx.stroke();
            }
            var colors = [
                {base:'#e64980',light:'#f783ac',dark:'#a61e4d'},
                {base:'#f03e3e',light:'#ff6b6b',dark:'#c92a2a'},
                {base:'#fd7e14',light:'#ffa94d',dark:'#e8590c'},
                {base:'#fab005',light:'#ffd43b',dark:'#e67700'},
                {base:'#82c91e',light:'#a9e34b',dark:'#5c940d'},
                {base:'#12b886',light:'#63e6be',dark:'#087f5b'},
                {base:'#228be6',light:'#74c0fc',dark:'#1864ab'},
                {base:'#7950f2',light:'#b197fc',dark:'#5f3dc4'},
            ];
            var board = [
                [0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,5,5,0,0,0,0],
                [0,0,0,5,5,0,0,0,0,0],
                [0,0,0,0,6,6,6,0,0,0],
                [0,0,0,0,0,6,0,0,0,0],
                [0,0,1,1,1,1,0,0,0,0],
                [0,0,0,2,2,0,0,0,0,0],
                [0,0,2,2,0,0,0,0,0,0],
                [3,3,3,3,3,3,3,3,3,0],
                [4,4,4,4,4,4,4,4,4,4],
                [7,7,7,7,7,7,7,7,7,7],
            ];
            board.forEach(function (row, r) {
                row.forEach(function (v, c) {
                    if (!v) return;
                    var x = ox + c*bw, y = oy + r*bh;
                    var col = colors[v-1];
                    // face gradient (top lighter, bottom darker)
                    var fg = ctx.createLinearGradient(x, y, x, y+bh);
                    fg.addColorStop(0, col.light);
                    fg.addColorStop(0.5, col.base);
                    fg.addColorStop(1, col.dark);
                    ctx.fillStyle = fg;
                    ctx.fillRect(x+1, y+1, bw-2, bh-2);
                    // top highlight strip (3D top face illusion)
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillRect(x+2, y+1, bw-4, 3);
                    // left highlight strip
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(x+1, y+1, 3, bh-2);
                    // right shadow strip
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x+bw-3, y+1, 2, bh-2);
                    // bottom shadow strip
                    ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    ctx.fillRect(x+2, y+bh-3, bw-4, 2);
                    // top-left corner highlight dot
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillRect(x+2, y+2, 3, 3);
                });
            });
        },

        /* ── PONG ───────────────────────────────────────────────────── */
        pong: function (ctx) {
            // deep black background with ambient center glow
            background(ctx, '#000');
            var ambG = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 110);
            ambG.addColorStop(0, 'rgba(60,60,80,0.55)');
            ambG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ambG; ctx.fillRect(0, 0, W, H);
            // scores
            ctx.fillStyle = C.white; ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'right'; ctx.fillText('7', W/2-16, 52);
            ctx.textAlign = 'left';  ctx.fillText('3', W/2+16, 52);
            // centre dashed line
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
            ctx.setLineDash([]);
            // paddle left — gradient white-to-grey + rounded
            var pg1 = ctx.createLinearGradient(14, 60, 26, 130);
            pg1.addColorStop(0, '#ffffff');
            pg1.addColorStop(0.5, '#e0e0e0');
            pg1.addColorStop(1, '#a0a0a0');
            roundRect(ctx, 14, 60, 12, 70, 6, pg1);
            // paddle left highlight
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(16, 63, 3, 20);
            // paddle right — gradient
            var pg2 = ctx.createLinearGradient(W-26, 100, W-14, 170);
            pg2.addColorStop(0, '#ffffff');
            pg2.addColorStop(0.5, '#e0e0e0');
            pg2.addColorStop(1, '#a0a0a0');
            roundRect(ctx, W-26, 100, 12, 70, 6, pg2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(W-24, 103, 3, 20);
            // ball trail (fading copies)
            [[115, 126, 0.12], [122, 123, 0.22], [130, 120, 0.35]].forEach(function(t){
                ctx.fillStyle = 'rgba(255,255,255,' + t[2] + ')';
                ctx.beginPath(); ctx.arc(t[0], t[1], 9, 0, Math.PI*2); ctx.fill();
            });
            // ball
            var bx = 130, by = 120;
            var ballG = ctx.createRadialGradient(bx-3, by-3, 0, bx, by, 9);
            ballG.addColorStop(0, '#ffffff');
            ballG.addColorStop(0.6, '#e8e8e8');
            ballG.addColorStop(1, '#aaaaaa');
            ctx.fillStyle = ballG;
            ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2); ctx.fill();
            // glow halo
            var glowG = ctx.createRadialGradient(bx, by, 4, bx, by, 28);
            glowG.addColorStop(0, 'rgba(255,255,255,0.35)');
            glowG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glowG;
            ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI*2); ctx.fill();
        },

        /* ── BREAKOUT ───────────────────────────────────────────────── */
        breakout: function (ctx) {
            // dark gradient background
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#0a0a1a');
            bgG.addColorStop(1, '#0d1b2a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var rows = [
                {base:'#e03131', light:'#ff6b6b', dark:'#7f0000'},
                {base:'#e8590c', light:'#ffa94d', dark:'#7d2d00'},
                {base:'#f59f00', light:'#ffd43b', dark:'#7d5100'},
                {base:'#2f9e44', light:'#8ce99a', dark:'#10401c'},
                {base:'#1971c2', light:'#74c0fc', dark:'#003a8c'},
                {base:'#9c36b5', light:'#da77f2', dark:'#4a0072'},
            ];
            var bw = 33, bh = 14, gap = 2, ox = 4, oy = 16;
            rows.forEach(function (col, r) {
                for (var c = 0; c < 6; c++) {
                    var bx = ox+c*(bw+gap), by = oy+r*(bh+gap);
                    // block face gradient (top lighter, bottom darker)
                    var fg = ctx.createLinearGradient(bx, by, bx, by+bh);
                    fg.addColorStop(0, col.light);
                    fg.addColorStop(0.4, col.base);
                    fg.addColorStop(1, col.dark);
                    roundRect(ctx, bx, by, bw, bh, 3, fg);
                    // top highlight strip
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(bx+2, by+1, bw-4, 3);
                    // right shadow edge
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fillRect(bx+bw-3, by+2, 2, bh-3);
                    // bottom shadow edge
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(bx+2, by+bh-3, bw-4, 2);
                    // top-left corner shine
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.fillRect(bx+2, by+2, 4, 2);
                }
            });
            // ball trail
            [[80,155,5,0.1],[90,148,6,0.2],[100,140,7,0.38]].forEach(function(b){
                ctx.fillStyle = 'rgba(255,255,255,' + b[3] + ')';
                ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, Math.PI*2); ctx.fill();
            });
            // ball
            var bx2 = 110, by2 = 132;
            var ballG = ctx.createRadialGradient(bx2-3, by2-3, 0, bx2, by2, 9);
            ballG.addColorStop(0, '#ffffff');
            ballG.addColorStop(0.6, '#e0e0ff');
            ballG.addColorStop(1, '#8888cc');
            ctx.fillStyle = ballG;
            ctx.beginPath(); ctx.arc(bx2, by2, 9, 0, Math.PI*2); ctx.fill();
            var glowG = ctx.createRadialGradient(bx2, by2, 3, bx2, by2, 22);
            glowG.addColorStop(0, 'rgba(200,200,255,0.4)');
            glowG.addColorStop(1, 'rgba(200,200,255,0)');
            ctx.fillStyle = glowG;
            ctx.beginPath(); ctx.arc(bx2, by2, 22, 0, Math.PI*2); ctx.fill();
            // paddle with gradient
            var padG = ctx.createLinearGradient(68, 196, 148, 208);
            padG.addColorStop(0, '#a5d8ff');
            padG.addColorStop(0.5, '#74c0fc');
            padG.addColorStop(1, '#1c7ed6');
            roundRect(ctx, 68, 196, 80, 12, 6, padG);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(72, 197, 30, 3);
        },

        /* ── 2048 ───────────────────────────────────────────────────── */
        '2048': function (ctx) {
            // beige gradient background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#faf8ef');
            bgG.addColorStop(1, '#f0ece0');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // board with subtle shadow
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            roundRect(ctx, 13, 13, 200, 200, 10, 'rgba(0,0,0,0.12)');
            roundRect(ctx, 10, 10, 200, 200, 8, '#bbada0');
            var tiles = [
                [2,4,8,16],
                [32,64,128,256],
                [512,1024,2048,0],
                [0,0,0,0],
            ];
            var tileColors = {
                2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',
                32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',
                512:'#edc850',1024:'#edc53f',2048:'#edc22e',
            };
            var textColors = {2:'#776e65',4:'#776e65'};
            tiles.forEach(function(row,r){
                row.forEach(function(v,c){
                    if(!v) return;
                    var x = 14+c*48, y = 14+r*48, s = 44;
                    // tile shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    roundRect(ctx, x+2, y+3, s, s, 4, 'rgba(0,0,0,0.18)');
                    // tile face
                    roundRect(ctx, x, y, s, s, 4, tileColors[v]||'#3c3a32');
                    // subtle top highlight for depth
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.fillRect(x+3, y+2, s-6, 6);
                    // text shadow (offset draw)
                    var tCol = textColors[v] || '#f9f6f2';
                    var fSize = v<100?18:v<1000?14:11;
                    ctx.font = 'bold '+fSize+'px Arial';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillText(v, x+s/2+1, y+s/2+1);
                    ctx.fillStyle = tCol;
                    ctx.fillText(v, x+s/2, y+s/2);
                });
            });
            ctx.textBaseline = 'alphabetic';
        },

        /* ── MEMORAMA ───────────────────────────────────────────────── */
        memorama: function (ctx) {
            gradBg(ctx, '#0d1b2a', '#16213e');
            var symbols = ['★', '♥', '♦', '♣', '◆', '♠', '♪', '♫'];
            var cols = 4, cw = 48, ch = 48, ox = 10, oy = 10;
            var revealed = [3, 7, 9, 14];
            for (var i = 0; i < 16; i++) {
                var cx2 = ox+(i%cols)*(cw+4), cy2 = oy+Math.floor(i/4)*(ch+4);
                // card drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                roundRect(ctx, cx2+3, cy2+4, cw, ch, 7, 'rgba(0,0,0,0.4)');
                if (revealed.indexOf(i) >= 0) {
                    // face-up card: deep green gradient
                    var rg = ctx.createLinearGradient(cx2, cy2, cx2, cy2+ch);
                    rg.addColorStop(0, '#2d8c5f');
                    rg.addColorStop(1, '#1a5e38');
                    roundRect(ctx, cx2, cy2, cw, ch, 6, rg);
                    // golden border
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 1.5;
                    roundRect(ctx, cx2+1, cy2+1, cw-2, ch-2, 6, null, '#ffd700');
                    // top highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.12)';
                    ctx.fillRect(cx2+4, cy2+3, cw-8, 8);
                    // symbol
                    ctx.fillStyle = '#a3f0c5';
                    ctx.font = 'bold 22px serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0,220,100,0.5)';
                    ctx.shadowBlur = 6;
                    ctx.fillText(symbols[i%symbols.length], cx2+cw/2, cy2+ch/2);
                    ctx.shadowBlur = 0;
                } else {
                    // face-down card: blue gradient
                    var bg2 = ctx.createLinearGradient(cx2, cy2, cx2+cw, cy2+ch);
                    bg2.addColorStop(0, '#1c5fa8');
                    bg2.addColorStop(1, '#0c3d7a');
                    roundRect(ctx, cx2, cy2, cw, ch, 6, bg2);
                    // diagonal diamond pattern
                    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                    ctx.lineWidth = 1;
                    var step = 10;
                    ctx.save();
                    ctx.beginPath(); ctx.rect(cx2+2, cy2+2, cw-4, ch-4); ctx.clip();
                    for (var d = -ch; d < cw+ch; d += step) {
                        ctx.beginPath(); ctx.moveTo(cx2+d, cy2); ctx.lineTo(cx2+d+ch, cy2+ch); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(cx2+d, cy2+ch); ctx.lineTo(cx2+d+ch, cy2); ctx.stroke();
                    }
                    ctx.restore();
                    // center diamond highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.18)';
                    ctx.save();
                    ctx.translate(cx2+cw/2, cy2+ch/2);
                    ctx.rotate(Math.PI/4);
                    ctx.fillRect(-8, -8, 16, 16);
                    ctx.restore();
                    // top gloss
                    var gloss = ctx.createLinearGradient(cx2, cy2, cx2, cy2+ch*0.45);
                    gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
                    gloss.addColorStop(1, 'rgba(255,255,255,0)');
                    roundRect(ctx, cx2, cy2, cw, ch*0.45, 6, gloss);
                }
            }
            ctx.textBaseline = 'alphabetic';
        },

        /* ── FLAPPY BIRD ────────────────────────────────────────────── */
        flappybird: function (ctx) {
            // rich sky gradient
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#1a6688');
            sky.addColorStop(0.45, '#3ba3c8');
            sky.addColorStop(0.75, '#6ecff0');
            sky.addColorStop(1, '#a8e4f7');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            // volumetric clouds
            [[30,40,28],[120,28,20],[170,55,22]].forEach(function(cl){
                var cg = ctx.createRadialGradient(cl[0], cl[1], 0, cl[0], cl[1], cl[2]);
                cg.addColorStop(0, 'rgba(255,255,255,0.95)');
                cg.addColorStop(0.6, 'rgba(255,255,255,0.75)');
                cg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = cg;
                ctx.beginPath(); ctx.arc(cl[0], cl[1], cl[2], 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]-15, cl[1]+8, cl[2]-8, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]+15, cl[1]+8, cl[2]-8, 0, Math.PI*2); ctx.fill();
            });
            // helper: draw one pipe segment with gradient
            function drawPipe(px, py, pw, ph, capTop) {
                var pg = ctx.createLinearGradient(px, py, px+pw, py);
                pg.addColorStop(0, '#4a9e1a');
                pg.addColorStop(0.3, '#73c42f');
                pg.addColorStop(0.7, '#5eb024');
                pg.addColorStop(1, '#2e7010');
                ctx.fillStyle = pg;
                ctx.fillRect(px, py, pw, ph);
                // pipe highlight stripe
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(px+4, py, 6, ph);
                // cap
                var capH = 20, capX = px-5, capW = pw+10;
                var capPy = capTop ? py+ph-capH : py;
                var capG = ctx.createLinearGradient(capX, capPy, capX+capW, capPy);
                capG.addColorStop(0, '#3d8c18');
                capG.addColorStop(0.3, '#6bb82a');
                capG.addColorStop(0.7, '#52a020');
                capG.addColorStop(1, '#264f0a');
                roundRect(ctx, capX, capPy, capW, capH, 3, capG);
                // cap highlight
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(capX+4, capPy+3, 8, capH-6);
            }
            drawPipe(60, 0, 44, 80, true);   // top pipe left
            drawPipe(60, 130, 44, H-130, false); // bottom pipe left
            drawPipe(160, 0, 44, 60, true);  // top pipe right
            drawPipe(160, 150, 44, H-150, false); // bottom pipe right
            // ground gradient
            var groundG = ctx.createLinearGradient(0, H-28, 0, H);
            groundG.addColorStop(0, '#a8865a');
            groundG.addColorStop(1, '#7a5c38');
            ctx.fillStyle = groundG; ctx.fillRect(0, H-24, W, 24);
            // grass strip
            var grassG = ctx.createLinearGradient(0, H-28, 0, H-20);
            grassG.addColorStop(0, '#8be028');
            grassG.addColorStop(1, '#5caa18');
            ctx.fillStyle = grassG; ctx.fillRect(0, H-28, W, 8);
            // bird body gradient
            var bx = 115, by = 95;
            var birdG = ctx.createRadialGradient(bx-4, by-4, 0, bx, by, 18);
            birdG.addColorStop(0, '#ffe066');
            birdG.addColorStop(0.5, '#f9c23c');
            birdG.addColorStop(1, '#e08c00');
            ctx.fillStyle = birdG;
            ctx.beginPath(); ctx.ellipse(bx, by, 16, 13, -0.15, 0, Math.PI*2); ctx.fill();
            // bird eye white
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(bx+6, by-4, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(bx+8, by-4, 3, 0, Math.PI*2); ctx.fill();
            // eye highlight
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(bx+9, by-5.5, 1.2, 0, Math.PI*2); ctx.fill();
            // beak
            ctx.fillStyle = '#e8590c';
            ctx.beginPath(); ctx.moveTo(bx+12, by+1); ctx.lineTo(bx+23, by-2); ctx.lineTo(bx+12, by+5); ctx.closePath(); ctx.fill();
            // beak highlight
            ctx.fillStyle = 'rgba(255,200,100,0.5)';
            ctx.beginPath(); ctx.moveTo(bx+13, by+1); ctx.lineTo(bx+21, by-1); ctx.lineTo(bx+13, by+2); ctx.closePath(); ctx.fill();
            // wing gradient
            var wingG = ctx.createRadialGradient(bx-4, by+2, 0, bx-4, by+3, 10);
            wingG.addColorStop(0, '#ffc840');
            wingG.addColorStop(1, '#d47a00');
            ctx.fillStyle = wingG;
            ctx.beginPath(); ctx.ellipse(bx-4, by+3, 8, 5, -0.4, 0, Math.PI*2); ctx.fill();
            // bird highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.ellipse(bx-5, by-5, 6, 4, -0.4, 0, Math.PI*2); ctx.fill();
        },

        /* ── SPACE INVADERS ─────────────────────────────────────────── */
        spaceinvaders: function (ctx) {
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
        },

        /* ── WHACK-A-MOLE ───────────────────────────────────────────── */
        whackamole: function (ctx) {
            // lawn gradient background
            var lawnG = ctx.createLinearGradient(0, 0, 0, H);
            lawnG.addColorStop(0, '#52b788');
            lawnG.addColorStop(1, '#1b4332');
            ctx.fillStyle = lawnG; ctx.fillRect(0, 0, W, H);
            // dirt patches texture
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (var di = 0; di < 12; di++) {
                ctx.beginPath(); ctx.ellipse(18*di+5, 100+Math.sin(di)*30, 12, 4, 0, 0, Math.PI*2); ctx.fill();
            }
            var holes = [[55,70],[165,70],[55,150],[165,150],[110,110]];
            holes.forEach(function(h, i) {
                // hole: radial gradient for depth
                var hg = ctx.createRadialGradient(h[0], h[1]+2, 0, h[0], h[1]+2, 26);
                hg.addColorStop(0, '#0a0a0a');
                hg.addColorStop(0.6, '#3e1f00');
                hg.addColorStop(1, '#6b3a1f');
                ctx.fillStyle = hg;
                ctx.beginPath(); ctx.ellipse(h[0], h[1]+5, 26, 10, 0, 0, Math.PI*2); ctx.fill();
                // outer dirt rim
                ctx.strokeStyle = '#5d3010'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.ellipse(h[0], h[1]+5, 26, 10, 0, 0, Math.PI*2); ctx.stroke();
                if (i === 2 || i === 4) {
                    // mole body — radial gradient brown
                    var mbG = ctx.createRadialGradient(h[0]-5, h[1]-15, 2, h[0], h[1]-5, 28);
                    mbG.addColorStop(0, '#c4956a');
                    mbG.addColorStop(0.5, '#8d6040');
                    mbG.addColorStop(1, '#4a2810');
                    ctx.fillStyle = mbG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-5, 22, 28, 0, 0, Math.PI); ctx.fill();
                    // face lighter
                    var faceG = ctx.createRadialGradient(h[0]-4, h[1]-16, 2, h[0], h[1]-12, 17);
                    faceG.addColorStop(0, '#d4b090');
                    faceG.addColorStop(0.6, '#b08060');
                    faceG.addColorStop(1, '#7a5030');
                    ctx.fillStyle = faceG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-12, 14, 16, 0, 0, Math.PI*2); ctx.fill();
                    // eyes
                    ctx.fillStyle = '#1a0a00';
                    ctx.beginPath(); ctx.arc(h[0]-5, h[1]-17, 3.5, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(h[0]+5, h[1]-17, 3.5, 0, Math.PI*2); ctx.fill();
                    // eye highlights
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(h[0]-4, h[1]-18.5, 1.2, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(h[0]+6, h[1]-18.5, 1.2, 0, Math.PI*2); ctx.fill();
                    // nose — pink radial
                    var noseG = ctx.createRadialGradient(h[0]-1, h[1]-12, 0, h[0], h[1]-11, 5);
                    noseG.addColorStop(0, '#ff80ab');
                    noseG.addColorStop(1, '#c2185b');
                    ctx.fillStyle = noseG;
                    ctx.beginPath(); ctx.ellipse(h[0], h[1]-11, 5, 4, 0, 0, Math.PI*2); ctx.fill();
                    // nose highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.beginPath(); ctx.arc(h[0]-1, h[1]-12.5, 1.5, 0, Math.PI*2); ctx.fill();
                    if (i === 4) {
                        // hammer handle — wood gradient
                        var handleG = ctx.createLinearGradient(h[0]+24, h[1]-50, h[0]+34, h[1]-26);
                        handleG.addColorStop(0, '#d4a55a');
                        handleG.addColorStop(0.5, '#a06830');
                        handleG.addColorStop(1, '#7a4a18');
                        ctx.fillStyle = handleG;
                        ctx.save();
                        ctx.translate(h[0]+28, h[1]-30);
                        ctx.rotate(0.5);
                        ctx.fillRect(-5, -20, 9, 24);
                        // hammer head — brick gradient
                        var headG = ctx.createLinearGradient(-15, -36, 15, -20);
                        headG.addColorStop(0, '#ef5350');
                        headG.addColorStop(0.5, '#b71c1c');
                        headG.addColorStop(1, '#7f0000');
                        ctx.fillStyle = headG;
                        ctx.fillRect(-14, -36, 28, 18);
                        // head highlight
                        ctx.fillStyle = 'rgba(255,150,150,0.4)';
                        ctx.fillRect(-12, -35, 24, 5);
                        ctx.restore();
                    }
                }
            });
            // grass strip bottom
            var grassG = ctx.createLinearGradient(0, 188, 0, H);
            grassG.addColorStop(0, '#52b788');
            grassG.addColorStop(1, '#2d6a4f');
            ctx.fillStyle = grassG; ctx.fillRect(0, 192, W, H-192);
            // grass blades
            [30,70,110,150,190].forEach(function(x){
                var bladeG = ctx.createLinearGradient(x, 192, x, 174);
                bladeG.addColorStop(0, '#40916c');
                bladeG.addColorStop(1, '#74c69d');
                ctx.fillStyle = bladeG;
                ctx.beginPath();
                ctx.moveTo(x, 192); ctx.lineTo(x-7, 175); ctx.lineTo(x, 183);
                ctx.lineTo(x+7, 175); ctx.closePath(); ctx.fill();
            });
        },

        /* ── SIMON ──────────────────────────────────────────────────── */
        simon: function (ctx) {
            background(ctx, '#0a0a0a');
            // 4 quadrants with radial gradients for depth
            var quads = [
                {col:'#27ae60', bright:'#2ecc71', dark:'#0d5c30', a:Math.PI,   b:1.5*Math.PI},
                {col:'#c0392b', bright:'#e74c3c', dark:'#5c0d08', a:1.5*Math.PI, b:2*Math.PI},
                {col:'#d68910', bright:'#f39c12', dark:'#6e4400', a:0.5*Math.PI, b:Math.PI},
                {col:'#2980b9', bright:'#3498db', dark:'#0d3c6b', a:0,           b:0.5*Math.PI},
            ];
            var active = 1; // red quad glowing
            var cx2 = W/2, cy2 = H/2, R = 106;
            quads.forEach(function(q, i) {
                // outer radial glow for active segment
                if (i === active) {
                    var glowG = ctx.createRadialGradient(cx2, cy2, 40, cx2, cy2, R+10);
                    glowG.addColorStop(0, q.bright + 'aa');
                    glowG.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = glowG;
                    ctx.beginPath(); ctx.moveTo(cx2, cy2);
                    ctx.arc(cx2, cy2, R+10, q.a, q.b);
                    ctx.closePath(); ctx.fill();
                }
                // radial gradient — brighter at rim, darker near centre
                var rg = ctx.createRadialGradient(cx2, cy2, 38, cx2, cy2, R);
                rg.addColorStop(0, i === active ? q.bright : q.dark);
                rg.addColorStop(0.5, i === active ? q.col : q.dark);
                rg.addColorStop(1, i === active ? q.bright : q.col + '99');
                ctx.fillStyle = rg;
                ctx.beginPath(); ctx.moveTo(cx2, cy2);
                ctx.arc(cx2, cy2, R, q.a, q.b);
                ctx.closePath(); ctx.fill();
                // active overlay highlight
                if (i === active) {
                    ctx.fillStyle = 'rgba(255,255,255,0.22)';
                    ctx.beginPath(); ctx.moveTo(cx2, cy2);
                    ctx.arc(cx2, cy2, R, q.a, q.b);
                    ctx.closePath(); ctx.fill();
                }
            });
            // divider lines
            ctx.strokeStyle = '#111'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(cx2, cy2-R); ctx.lineTo(cx2, cy2+R); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx2-R, cy2); ctx.lineTo(cx2+R, cy2); ctx.stroke();
            // centre circle with metallic gradient
            var centG = ctx.createRadialGradient(cx2-8, cy2-8, 2, cx2, cy2, 40);
            centG.addColorStop(0, '#555');
            centG.addColorStop(0.5, '#222');
            centG.addColorStop(1, '#0a0a0a');
            ctx.fillStyle = centG;
            ctx.beginPath(); ctx.arc(cx2, cy2, 40, 0, Math.PI*2); ctx.fill();
            // metallic rim
            ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx2, cy2, 40, 0, Math.PI*2); ctx.stroke();
            // inner button
            var btnG = ctx.createRadialGradient(cx2-5, cy2-5, 1, cx2, cy2, 22);
            btnG.addColorStop(0, '#888');
            btnG.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = btnG;
            ctx.beginPath(); ctx.arc(cx2, cy2, 22, 0, Math.PI*2); ctx.fill();
            // logo text with gradient
            var tg = ctx.createLinearGradient(cx2-24, cy2, cx2+24, cy2);
            tg.addColorStop(0, '#ccc');
            tg.addColorStop(0.5, '#fff');
            tg.addColorStop(1, '#ccc');
            ctx.fillStyle = tg;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SIMON', cx2, cy2);
            ctx.textBaseline = 'alphabetic';
        },

        /* ── RUNNER ─────────────────────────────────────────────────── */
        runner: function (ctx) {
            // night sky gradient
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#060614');
            sky.addColorStop(0.6, '#1a1a2e');
            sky.addColorStop(1, '#2c2c4a');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
            // stars varied sizes
            [[20,20,1],[60,15,2],[100,30,1],[150,12,2],[190,22,1],[35,45,1],[80,50,2],[130,40,1],[10,55,1],[170,30,1]].forEach(function(s){
                ctx.fillStyle = s[2]===2 ? 'rgba(255,255,255,0.9)':'rgba(255,255,255,0.5)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // moon halo
            var moonHalo = ctx.createRadialGradient(185, 25, 10, 185, 25, 30);
            moonHalo.addColorStop(0, 'rgba(255,230,100,0.25)');
            moonHalo.addColorStop(1, 'rgba(255,230,100,0)');
            ctx.fillStyle = moonHalo; ctx.fillRect(155, 0, 60, 60);
            // moon body
            var moonG = ctx.createRadialGradient(182, 22, 1, 185, 25, 12);
            moonG.addColorStop(0, '#fff8c0');
            moonG.addColorStop(0.6, '#ffe066');
            moonG.addColorStop(1, '#c8a800');
            ctx.fillStyle = moonG;
            ctx.beginPath(); ctx.arc(185, 25, 12, 0, Math.PI*2); ctx.fill();
            // moon crescent shadow
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(190, 22, 10, 0, Math.PI*2); ctx.fill();
            // ground sandy gradient
            var groundG = ctx.createLinearGradient(0, 162, 0, H);
            groundG.addColorStop(0, '#e9c46a');
            groundG.addColorStop(0.15, '#d4a843');
            groundG.addColorStop(1, '#8b6020');
            ctx.fillStyle = groundG; ctx.fillRect(0, 162, W, H-162);
            // ground line
            ctx.fillStyle = '#7a5010'; ctx.fillRect(0, 162, W, 4);
            // cactus helper
            function drawCactus(cx, cy, w, h) {
                var cg = ctx.createLinearGradient(cx, cy, cx+w, cy);
                cg.addColorStop(0, '#1a7a6e');
                cg.addColorStop(0.4, '#2a9d8f');
                cg.addColorStop(1, '#1a6060');
                ctx.fillStyle = cg;
                roundRect(ctx, cx, cy, w, h, Math.min(w/2, 4), cg);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(cx+2, cy+4, 3, h-8);
            }
            // cactus 1
            drawCactus(150, 118, 10, 48);
            drawCactus(136, 130, 12, 8);  // left arm
            drawCactus(128, 118, 8, 20);
            drawCactus(160, 126, 10, 8); // right arm base
            drawCactus(162, 118, 8, 16);
            // cactus 2 small
            drawCactus(191, 138, 8, 28);
            drawCactus(183, 143, 14, 6);
            // cactus shadows
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(154, 166, 16, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(195, 166, 8, 3, 0, 0, Math.PI*2); ctx.fill();
            // dino body gradient
            var dx = 50, dy = 128;
            var dinoG = ctx.createLinearGradient(dx, dy, dx+35, dy+32);
            dinoG.addColorStop(0, '#6ab88a');
            dinoG.addColorStop(0.5, '#4a9c6d');
            dinoG.addColorStop(1, '#2d7050');
            // dino shadow
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(dx+16, 162, 20, 5, 0, 0, Math.PI*2); ctx.fill();
            // body
            ctx.fillStyle = dinoG;
            ctx.fillRect(dx, dy, 32, 28);
            // head
            var headG = ctx.createLinearGradient(dx+18, dy-18, dx+36, dy+2);
            headG.addColorStop(0, '#7acc96');
            headG.addColorStop(1, '#3a8c5d');
            ctx.fillStyle = headG;
            ctx.fillRect(dx+18, dy-16, 18, 18);
            // snout
            ctx.fillStyle = '#4a9c6d';
            ctx.fillRect(dx+28, dy-10, 12, 7);
            // eye white + pupil
            ctx.fillStyle = '#fff';
            ctx.fillRect(dx+30, dy-14, 7, 5);
            ctx.fillStyle = '#111';
            ctx.fillRect(dx+33, dy-13, 3, 4);
            ctx.fillStyle = '#fff';
            ctx.fillRect(dx+34, dy-13, 1, 1);
            // legs run pose
            ctx.fillStyle = '#3a7050';
            ctx.fillRect(dx+4, dy+28, 8, 16);
            ctx.fillRect(dx+18, dy+28, 8, 8);
            // tail
            ctx.fillStyle = '#4a9c6d';
            ctx.beginPath(); ctx.moveTo(dx, dy+8); ctx.quadraticCurveTo(dx-10, dy+12, dx-6, dy+20); ctx.lineTo(dx, dy+16); ctx.closePath(); ctx.fill();
            // belly highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(dx+4, dy+4, 10, 18);
            // score
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('01480', W-8, 20);
        },

        /* ── MINESWEEPER ────────────────────────────────────────────── */
        minesweeper: function (ctx) {
            // silver background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#d8d8d8');
            bgG.addColorStop(1, '#b0b0b0');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var cell = 22, ox = 10, oy = 10;
            var board = [
                [0, 1, 0, 0, 0, 1, 0, 0, 0],
                [1, 2, 1, 0, 1, 2, 1, 0, 0],
                [0, 1, 0, 0, 0, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 0, 1,-1, 1, 0, 0, 1, 1],
                [0, 0, 0, 1, 1, 0, 0, 1,-2],
                [0, 0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0],
            ];
            var numCols = ['','#1565c0','#2e7d32','#c62828','#4a148c','#880e4f','#006064','#212121','#546e7a'];
            board.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var x = ox+c*cell, y = oy+r*cell;
                    if (v === -2) {
                        // unrevealed — 3D bevel effect
                        var cellG = ctx.createLinearGradient(x, y, x+cell, y+cell);
                        cellG.addColorStop(0, '#d0d0d0');
                        cellG.addColorStop(1, '#a8a8a8');
                        ctx.fillStyle = cellG;
                        ctx.fillRect(x, y, cell-1, cell-1);
                        // top-left highlight bevel
                        ctx.fillStyle = 'rgba(255,255,255,0.8)';
                        ctx.fillRect(x, y, cell-1, 2);
                        ctx.fillRect(x, y, 2, cell-1);
                        // bottom-right shadow bevel
                        ctx.fillStyle = 'rgba(0,0,0,0.35)';
                        ctx.fillRect(x+cell-2, y, 1, cell-1);
                        ctx.fillRect(x, y+cell-2, cell-1, 1);
                    } else if (v === -1) {
                        // exploded mine — red cell
                        ctx.fillStyle = '#ef5350';
                        ctx.fillRect(x, y, cell-1, cell-1);
                        // mine body
                        var mineG = ctx.createRadialGradient(x+cell/2-1, y+cell/2-2, 0, x+cell/2, y+cell/2, 7);
                        mineG.addColorStop(0, '#555');
                        mineG.addColorStop(1, '#111');
                        ctx.fillStyle = mineG;
                        ctx.beginPath(); ctx.arc(x+cell/2, y+cell/2, 6, 0, Math.PI*2); ctx.fill();
                        // mine highlight
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.beginPath(); ctx.arc(x+cell/2-2, y+cell/2-2, 2, 0, Math.PI*2); ctx.fill();
                        // spikes
                        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
                        for (var si = 0; si < 8; si++) {
                            var sa = si * Math.PI/4;
                            ctx.beginPath(); ctx.moveTo(x+cell/2, y+cell/2);
                            ctx.lineTo(x+cell/2+Math.cos(sa)*9, y+cell/2+Math.sin(sa)*9);
                            ctx.stroke();
                        }
                    } else {
                        // revealed cell — flat with inner shadow top/left
                        ctx.fillStyle = '#cacaca';
                        ctx.fillRect(x, y, cell-1, cell-1);
                        ctx.fillStyle = 'rgba(0,0,0,0.12)';
                        ctx.fillRect(x, y, cell-1, 1);
                        ctx.fillRect(x, y, 1, cell-1);
                        if (v > 0) {
                            ctx.fillStyle = numCols[v];
                            ctx.font = 'bold 12px sans-serif';
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillText(v, x+cell/2, y+cell/2);
                        }
                    }
                });
            });
            // flag cell
            var fx = ox+7*cell, fy = oy+4*cell;
            var flagCellG = ctx.createLinearGradient(fx, fy, fx+cell, fy+cell);
            flagCellG.addColorStop(0, '#d0d0d0');
            flagCellG.addColorStop(1, '#a8a8a8');
            ctx.fillStyle = flagCellG;
            ctx.fillRect(fx, fy, cell-1, cell-1);
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(fx, fy, cell-1, 2); ctx.fillRect(fx, fy, 2, cell-1);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(fx+cell-2, fy, 1, cell-1); ctx.fillRect(fx, fy+cell-2, cell-1, 1);
            // flag shape
            var flagG = ctx.createLinearGradient(fx+7, fy+4, fx+18, fy+12);
            flagG.addColorStop(0, '#ff5252');
            flagG.addColorStop(1, '#b71c1c');
            ctx.fillStyle = flagG;
            ctx.beginPath(); ctx.moveTo(fx+7, fy+4); ctx.lineTo(fx+18, fy+8); ctx.lineTo(fx+7, fy+12); ctx.fill();
            ctx.fillStyle = '#222';
            ctx.fillRect(fx+6, fy+4, 2, 14);
            ctx.fillRect(fx+2, fy+18, 12, 2);
            ctx.textBaseline = 'alphabetic';
        },

        /* ── TIC-TAC-TOE ────────────────────────────────────────────── */
        tictactoe: function (ctx) {
            // deep blue gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0d1547');
            bgG.addColorStop(1, '#1a237e');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle grid texture dots
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (var gi = 0; gi < 11; gi++) {
                for (var gj = 0; gj < 11; gj++) {
                    ctx.fillRect(gi*22+1, gj*22+1, 1, 1);
                }
            }
            // grid lines with glow
            ctx.lineCap = 'round';
            [73, 147].forEach(function(p) {
                // glow layer
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.moveTo(p, 15); ctx.lineTo(p, 205); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(15, p); ctx.lineTo(205, p); ctx.stroke();
                // crisp line
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(p, 15); ctx.lineTo(p, 205); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(15, p); ctx.lineTo(205, p); ctx.stroke();
            });
            // board pieces
            var board2 = [['X','O','X'],['O','X','O'],['O','','X']];
            board2.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var pcx = 15+c*73+36, pcy = 15+r*73+36;
                    if (v === 'X') {
                        // red glow
                        ctx.strokeStyle = 'rgba(239,83,80,0.25)'; ctx.lineWidth = 14;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                        // crisp X
                        ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                        // bright highlight
                        ctx.strokeStyle = 'rgba(255,180,180,0.5)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(pcx-20, pcy-20); ctx.lineTo(pcx+20, pcy+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(pcx+20, pcy-20); ctx.lineTo(pcx-20, pcy+20); ctx.stroke();
                    } else if (v === 'O') {
                        // blue glow
                        ctx.strokeStyle = 'rgba(66,165,245,0.25)'; ctx.lineWidth = 14;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                        // crisp O
                        ctx.strokeStyle = '#42a5f5'; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                        // highlight arc
                        ctx.strokeStyle = 'rgba(180,230,255,0.5)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(pcx, pcy, 20, 0, Math.PI*2); ctx.stroke();
                    }
                });
            });
            // winning diagonal line — golden with glow
            ctx.strokeStyle = 'rgba(255,238,88,0.3)'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(51, 51); ctx.lineTo(183, 183); ctx.stroke();
            ctx.strokeStyle = '#ffee58'; ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]);
            ctx.beginPath(); ctx.moveTo(51, 51); ctx.lineTo(183, 183); ctx.stroke();
            ctx.setLineDash([]);
        },

        /* ── CONNECT FOUR ───────────────────────────────────────────── */
        connectfour: function (ctx) {
            // board gradient
            var boardG = ctx.createLinearGradient(0, 0, 0, H);
            boardG.addColorStop(0, '#1976d2');
            boardG.addColorStop(1, '#0d47a1');
            ctx.fillStyle = boardG; ctx.fillRect(0, 0, W, H);
            // board edge highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(0, 0, W, 3);
            ctx.fillRect(0, 0, 3, H);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(W-3, 0, 3, H);
            ctx.fillRect(0, H-3, W, 3);
            var disc = [
                [0,1,0,1,0,1,0],
                [1,0,1,0,1,0,0],
                [0,1,2,1,2,0,0],
                [1,0,1,2,1,0,0],
                [0,1,0,0,2,0,0],
                [1,2,2,1,2,1,2],
            ];
            var winCells = [[3,3],[3,4],[3,5],[3,6]];
            function isWin(r, c) {
                return winCells.some(function(w){ return w[0]===r && w[1]===c; });
            }
            for (var r = 0; r < 6; r++) {
                for (var c = 0; c < 7; c++) {
                    var cx2 = 15+c*29, cy2 = 15+r*29;
                    var v = disc[r][c];
                    var win = isWin(r, c);
                    if (v === 0) {
                        // empty hole — dark inset with inner shadow
                        var holeG = ctx.createRadialGradient(cx2+12, cy2+12, 0, cx2+10, cy2+10, 13);
                        holeG.addColorStop(0, '#070d1f');
                        holeG.addColorStop(0.6, '#0a1535');
                        holeG.addColorStop(1, '#0d2266');
                        ctx.fillStyle = holeG;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                    } else if (v === 1) {
                        // red disc
                        var rg = ctx.createRadialGradient(cx2+5, cy2+4, 1, cx2+10, cy2+10, 13);
                        rg.addColorStop(0, '#ffcdd2');
                        rg.addColorStop(0.35, '#ef5350');
                        rg.addColorStop(1, '#7f0000');
                        ctx.fillStyle = rg;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                        if (win) {
                            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
                            ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 13, 0, Math.PI*2); ctx.stroke();
                            var wg = ctx.createRadialGradient(cx2+10, cy2+10, 8, cx2+10, cy2+10, 18);
                            wg.addColorStop(0, 'rgba(255,255,255,0.3)');
                            wg.addColorStop(1, 'rgba(255,255,255,0)');
                            ctx.fillStyle = wg;
                            ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 18, 0, Math.PI*2); ctx.fill();
                        }
                    } else {
                        // yellow disc
                        var yg = ctx.createRadialGradient(cx2+5, cy2+4, 1, cx2+10, cy2+10, 13);
                        yg.addColorStop(0, '#fffde7');
                        yg.addColorStop(0.35, '#ffd740');
                        yg.addColorStop(1, '#e65100');
                        ctx.fillStyle = yg;
                        ctx.beginPath(); ctx.arc(cx2+10, cy2+10, 12, 0, Math.PI*2); ctx.fill();
                    }
                }
            }
            // win glow line connecting winning discs
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(15+3*29+10, 15+3*29+10);
            ctx.lineTo(15+6*29+10, 15+3*29+10);
            ctx.stroke();
        },

        /* ── ASTEROIDS ──────────────────────────────────────────────── */
        asteroids: function (ctx) {
            background(ctx, '#000');
            // deep space nebula hints
            var neb1 = ctx.createRadialGradient(50, 100, 0, 50, 100, 80);
            neb1.addColorStop(0, 'rgba(20,0,60,0.3)');
            neb1.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb1; ctx.fillRect(0, 20, 130, 180);
            var neb2 = ctx.createRadialGradient(180, 60, 0, 180, 60, 60);
            neb2.addColorStop(0, 'rgba(0,20,50,0.25)');
            neb2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = neb2; ctx.fillRect(120, 0, 100, 120);
            // stars — varied sizes and brightness
            [[10,15,2],[40,8,1],[80,20,1],[120,5,2],[160,18,1],[200,10,2],[25,50,1],
             [70,45,2],[130,38,1],[185,52,1],[50,80,1],[100,90,2],[170,75,1],[15,100,1]].forEach(function(s, i){
                ctx.fillStyle = s[2] === 2 ? 'rgba(255,255,255,0.95)':'rgba(255,255,255,0.5)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // asteroid drawing with gradient fill
            function asteroid(acx, acy, ar, pts, offsets) {
                // gradient fill
                var ag = ctx.createRadialGradient(acx-ar*0.25, acy-ar*0.25, 0, acx, acy, ar);
                ag.addColorStop(0, '#888');
                ag.addColorStop(0.5, '#555');
                ag.addColorStop(1, '#222');
                ctx.fillStyle = ag;
                ctx.beginPath();
                for (var ai = 0; ai < pts; ai++) {
                    var aa = ai*(2*Math.PI/pts);
                    var off = offsets ? offsets[ai % offsets.length] : (0.82 + Math.sin(ai*3.7)*0.18);
                    var arr = ar * off;
                    if (ai === 0) ctx.moveTo(acx+Math.cos(aa)*arr, acy+Math.sin(aa)*arr);
                    else ctx.lineTo(acx+Math.cos(aa)*arr, acy+Math.sin(aa)*arr);
                }
                ctx.closePath(); ctx.fill();
                // outline
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.8;
                ctx.beginPath();
                for (var ai2 = 0; ai2 < pts; ai2++) {
                    var aa2 = ai2*(2*Math.PI/pts);
                    var off2 = offsets ? offsets[ai2 % offsets.length] : (0.82 + Math.sin(ai2*3.7)*0.18);
                    var arr2 = ar * off2;
                    if (ai2 === 0) ctx.moveTo(acx+Math.cos(aa2)*arr2, acy+Math.sin(aa2)*arr2);
                    else ctx.lineTo(acx+Math.cos(aa2)*arr2, acy+Math.sin(aa2)*arr2);
                }
                ctx.closePath(); ctx.stroke();
                // surface highlight
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.beginPath(); ctx.arc(acx-ar*0.2, acy-ar*0.2, ar*0.35, 0, Math.PI*2); ctx.fill();
            }
            asteroid(60, 62, 36, 8, [0.9,0.75,0.85,0.95,0.78,0.88,0.82,0.9]);
            asteroid(172, 82, 22, 7, [0.88,0.78,0.92,0.82,0.88,0.75,0.9]);
            asteroid(132, 167, 17, 6, [0.85,0.92,0.78,0.88,0.82,0.9]);
            asteroid(42, 157, 13, 5, [0.88,0.78,0.9,0.82,0.85]);
            // fragments
            [[186,28,8,5],[202,44,5,4],[178,52,6,5]].forEach(function(f){
                asteroid(f[0], f[1], f[2], f[3]);
            });
            // player ship with glow
            var sx = 110, sy = 120, sa = -Math.PI/2;
            // ship glow
            var shipGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 30);
            shipGlow.addColorStop(0, 'rgba(143,211,244,0.2)');
            shipGlow.addColorStop(1, 'rgba(143,211,244,0)');
            ctx.fillStyle = shipGlow;
            ctx.fillRect(sx-30, sy-30, 60, 60);
            // ship body
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(143,211,244,0.18)';
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa)*22, sy+Math.sin(sa)*22);
            ctx.lineTo(sx+Math.cos(sa+2.4)*16, sy+Math.sin(sa+2.4)*16);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*8, sy+Math.sin(sa+Math.PI)*8);
            ctx.lineTo(sx+Math.cos(sa-2.4)*16, sy+Math.sin(sa-2.4)*16);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // thrust flame
            var thrustG = ctx.createLinearGradient(
                sx+Math.cos(sa+Math.PI)*10, sy+Math.sin(sa+Math.PI)*10,
                sx+Math.cos(sa+Math.PI)*24, sy+Math.sin(sa+Math.PI)*24
            );
            thrustG.addColorStop(0, '#ffe066');
            thrustG.addColorStop(0.5, '#ff6b35');
            thrustG.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.strokeStyle = thrustG; ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa+2.4)*11, sy+Math.sin(sa+2.4)*11);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*22, sy+Math.sin(sa+Math.PI)*22);
            ctx.lineTo(sx+Math.cos(sa-2.4)*11, sy+Math.sin(sa-2.4)*11);
            ctx.stroke();
            // bullet glow
            [[sx,sy-46],[sx,sy-62]].forEach(function(b){
                var bulG = ctx.createRadialGradient(b[0], b[1]-4, 0, b[0], b[1]-4, 6);
                bulG.addColorStop(0, 'rgba(255,255,255,0.5)');
                bulG.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = bulG;
                ctx.fillRect(b[0]-5, b[1]-8, 10, 16);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1]-10); ctx.stroke();
            });
        },

        /* ── FROGGER ────────────────────────────────────────────────── */
        frogger: function (ctx) {
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
        },

        /* ── WORDLE ─────────────────────────────────────────────────── */
        wordle: function (ctx) {
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#121213');
            bgG.addColorStop(1, '#1a1a2e');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            var grid = [
                ['C','I','E','L','O'],
                ['A','G','U','A','S'],
                ['S','O','L','A','R'],
                ['','','','',''],
                ['','','','',''],
                ['','','','',''],
            ];
            var states = [
                [2,1,0,2,0],
                [0,0,2,1,0],
                [2,2,2,2,2],
            ];
            // state colors: absent, present, correct
            var stateBase = ['#3a3a3c','#b59f3b','#538d4e'];
            var stateLight = ['#555','#d4b850','#6aad5e'];
            var cw = 36, ch = 36, gap = 5, ox = 12, oy = 8;
            grid.forEach(function(row, r) {
                row.forEach(function(v, c) {
                    var x = ox+c*(cw+gap), y = oy+r*(ch+gap);
                    if (r < 3) {
                        var si = states[r][c];
                        // tile gradient
                        var tg = ctx.createLinearGradient(x, y, x, y+ch);
                        tg.addColorStop(0, stateLight[si]);
                        tg.addColorStop(1, stateBase[si]);
                        roundRect(ctx, x, y, cw, ch, 4, tg);
                        // tile top highlight
                        ctx.fillStyle = 'rgba(255,255,255,0.12)';
                        ctx.fillRect(x+3, y+2, cw-6, 6);
                        // letter shadow
                        if (v) {
                            ctx.font = 'bold 20px sans-serif';
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillStyle = 'rgba(0,0,0,0.35)';
                            ctx.fillText(v, x+cw/2+1, y+ch/2+1);
                            ctx.fillStyle = '#fff';
                            ctx.fillText(v, x+cw/2, y+ch/2);
                        }
                    } else {
                        // empty tile outline
                        ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 2;
                        roundRect(ctx, x, y, cw, ch, 4, '#121213', '#3a3a3c');
                    }
                });
            });
            // "WORDLE" header
            var hg = ctx.createLinearGradient(ox, 0, ox+5*(cw+gap), 0);
            hg.addColorStop(0, '#8fd3f4');
            hg.addColorStop(1, '#ff512f');
            ctx.fillStyle = hg;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('WORDLE', W/2, H-6);
        },

        /* ── TYPING SPEED ───────────────────────────────────────────── */
        typingspeed: function (ctx) {
            // gradient background
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0a0a1f');
            bgG.addColorStop(1, '#0f3460');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // panel with drop shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            roundRect(ctx, 16, 32, 192, 162, 14, 'rgba(0,0,0,0.35)');
            // panel face
            var panelG = ctx.createLinearGradient(14, 30, 14, 190);
            panelG.addColorStop(0, 'rgba(45,45,65,0.92)');
            panelG.addColorStop(1, 'rgba(28,28,42,0.92)');
            roundRect(ctx, 14, 30, 192, 162, 12, panelG);
            // panel top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(16, 31, 188, 8);
            // WPM gradient number
            var numG = ctx.createLinearGradient(W/2-40, 50, W/2+40, 95);
            numG.addColorStop(0, '#8fd3f4');
            numG.addColorStop(1, '#ff512f');
            ctx.fillStyle = numG;
            ctx.font = 'bold 56px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillText('82', W/2+2, 87);
            ctx.fillStyle = numG;
            ctx.fillText('82', W/2, 85);
            // label
            ctx.fillStyle = '#777'; ctx.font = '10px sans-serif';
            ctx.fillText('PALABRAS / MIN', W/2, 112);
            // typed word
            ctx.fillStyle = '#eee'; ctx.font = 'bold 22px monospace';
            ctx.fillText('RAPIDO', W/2, 148);
            // cursor blink bar
            ctx.fillStyle = '#8fd3f4';
            ctx.fillRect(134, 136, 2, 20);
            // input underline — gradient
            var ulG = ctx.createLinearGradient(34, 0, 186, 0);
            ulG.addColorStop(0, '#8fd3f4');
            ulG.addColorStop(1, '#ff512f');
            ctx.strokeStyle = ulG; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(34, 162); ctx.lineTo(186, 162); ctx.stroke();
            // timer bar track
            roundRect(ctx, 14, 180, 192, 10, 5, '#1a1a2e');
            // timer bar fill with gradient
            var tg = ctx.createLinearGradient(14, 0, 206, 0);
            tg.addColorStop(0, '#8fd3f4');
            tg.addColorStop(1, '#ff512f');
            roundRect(ctx, 14, 180, 128, 10, 5, tg);
            // timer bar shine
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            roundRect(ctx, 14, 180, 128, 4, 5, 'rgba(255,255,255,0.22)');
            ctx.textBaseline = 'alphabetic';
        },

        /* ── SLIDING PUZZLE ─────────────────────────────────────────── */
        slidingpuzzle: function (ctx) {
            // deep purple-blue gradient
            var bgG = ctx.createLinearGradient(0, 0, W, H);
            bgG.addColorStop(0, '#0d1347');
            bgG.addColorStop(1, '#2a0050');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // subtle dot texture
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (var di = 0; di < 10; di++) {
                for (var dj = 0; dj < 10; dj++) {
                    ctx.fillRect(di*22+4, dj*22+4, 2, 2);
                }
            }
            // board shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            roundRect(ctx, 14, 14, 196, 196, 10, 'rgba(0,0,0,0.4)');
            // board background
            roundRect(ctx, 12, 12, 196, 196, 8, 'rgba(10,10,40,0.6)');
            var nums = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15];
            var sz = 44, gap = 4, ox = 14, oy = 14;
            nums.forEach(function(v, i) {
                var x = ox+(i%4)*(sz+gap), y = oy+Math.floor(i/4)*(sz+gap);
                if (v === 0) {
                    // empty slot — recessed
                    var emptyG = ctx.createRadialGradient(x+sz/2, y+sz/2, 0, x+sz/2, y+sz/2, sz/2);
                    emptyG.addColorStop(0, 'rgba(0,0,0,0.5)');
                    emptyG.addColorStop(1, 'rgba(0,0,20,0.2)');
                    roundRect(ctx, x, y, sz, sz, 6, emptyG);
                    // arrow indicator on empty slot
                    ctx.fillStyle = 'rgba(255,220,50,0.5)';
                    ctx.font = '20px sans-serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('15', x+sz/2, y+sz/2);
                    ctx.textBaseline = 'alphabetic';
                    return;
                }
                // tile shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                roundRect(ctx, x+3, y+4, sz, sz, 6, 'rgba(0,0,0,0.4)');
                // tile gradient — diagonal blue-to-purple
                var tg = ctx.createLinearGradient(x, y, x+sz, y+sz);
                tg.addColorStop(0, '#6272c8');
                tg.addColorStop(0.5, '#4f5ebf');
                tg.addColorStop(1, '#7c4dff');
                roundRect(ctx, x, y, sz, sz, 6, tg);
                // top highlight
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(x+3, y+2, sz-6, 7);
                // left highlight
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(x+2, y+3, 5, sz-6);
                // number shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.font = 'bold '+(v<10?20:16)+'px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(v, x+sz/2+1, y+sz/2+1);
                ctx.fillStyle = '#fff';
                ctx.fillText(v, x+sz/2, y+sz/2);
            });
            ctx.textBaseline = 'alphabetic';
        },

        /* ── FRUIT CATCHER ──────────────────────────────────────────── */
        fruitcatcher: function (ctx) {
            // night sky gradient
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#050d1a');
            bgG.addColorStop(1, '#0d2a4a');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
            // stars
            [[20,15,1],[55,8,2],[95,20,1],[140,10,2],[180,18,1],[10,40,1],[170,50,1]].forEach(function(s){
                ctx.fillStyle = s[2]===2 ? 'rgba(255,255,255,0.8)':'rgba(255,255,255,0.45)';
                ctx.fillRect(s[0], s[1], s[2], s[2]);
            });
            // fruits — each drawn as canvas shapes (no emoji)
            var fruits = [
                {x:30,  y:42,  col:'#ff4444', col2:'#8b0000', stemCol:'#228b22', r:15},
                {x:90,  y:22,  col:'#ffe033', col2:'#b8860b', stemCol:'#228b22', r:13},
                {x:155, y:58,  col:'#66cc44', col2:'#1a6b00', stemCol:'#aa5500', r:14},
                {x:200, y:32,  col:'#ff8c00', col2:'#8b4500', stemCol:'#228b22', r:13},
                {x:65,  y:92,  col:'#ff3399', col2:'#880044', stemCol:'#228b22', r:12},
                {x:130, y:78,  col:'#7744ee', col2:'#2a0088', stemCol:'#aa5500', r:11},
            ];
            fruits.forEach(function(f) {
                // drop shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(f.x+2, f.y+f.r+2, f.r*0.7, f.r*0.3, 0, 0, Math.PI*2); ctx.fill();
                // fruit body
                var fg = ctx.createRadialGradient(f.x-f.r*0.35, f.y-f.r*0.35, 0, f.x, f.y, f.r);
                fg.addColorStop(0, '#fff');
                fg.addColorStop(0.18, f.col);
                fg.addColorStop(1, f.col2);
                ctx.fillStyle = fg;
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill();
                // outline
                ctx.strokeStyle = f.col2; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.stroke();
                // shine ellipse
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.beginPath(); ctx.ellipse(f.x-f.r*0.3, f.y-f.r*0.28, f.r*0.38, f.r*0.22, -0.4, 0, Math.PI*2); ctx.fill();
                // stem
                ctx.strokeStyle = f.stemCol; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(f.x+1, f.y-f.r); ctx.quadraticCurveTo(f.x+5, f.y-f.r-5, f.x+4, f.y-f.r-4); ctx.stroke();
                // motion trail
                ctx.strokeStyle = f.col + '55'; ctx.lineWidth = 1.5; ctx.setLineDash([3,4]);
                ctx.beginPath(); ctx.moveTo(f.x, f.y-f.r); ctx.lineTo(f.x, f.y-f.r-14); ctx.stroke();
                ctx.setLineDash([]);
            });
            // bomb with glow
            var bombG = ctx.createRadialGradient(183, 107, 0, 185, 110, 15);
            bombG.addColorStop(0, '#666');
            bombG.addColorStop(0.5, '#333');
            bombG.addColorStop(1, '#111');
            ctx.fillStyle = bombG;
            ctx.beginPath(); ctx.arc(185, 110, 14, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(185, 110, 14, 0, Math.PI*2); ctx.stroke();
            // bomb highlight
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.arc(181, 105, 5, 0, Math.PI*2); ctx.fill();
            // fuse
            ctx.strokeStyle = '#aa8800'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(185, 96); ctx.quadraticCurveTo(189, 90, 185, 85); ctx.stroke();
            // fuse spark
            var sparkG = ctx.createRadialGradient(185, 84, 0, 185, 84, 6);
            sparkG.addColorStop(0, '#fff9c4');
            sparkG.addColorStop(0.4, '#ff6b35');
            sparkG.addColorStop(1, 'rgba(255,80,0,0)');
            ctx.fillStyle = sparkG;
            ctx.beginPath(); ctx.arc(185, 84, 6, 0, Math.PI*2); ctx.fill();
            // basket with gradient
            var bx = 68, by = 172, bw = 84, bh = 32;
            var basketG = ctx.createLinearGradient(bx, by, bx, by+bh);
            basketG.addColorStop(0, '#c8901e');
            basketG.addColorStop(0.5, '#8b6914');
            basketG.addColorStop(1, '#5a4010');
            ctx.fillStyle = basketG;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx+bw, by);
            ctx.lineTo(bx+bw-10, by+bh); ctx.lineTo(bx+10, by+bh);
            ctx.closePath(); ctx.fill();
            // basket outline
            ctx.strokeStyle = '#5a4010'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(bx+bw, by);
            ctx.lineTo(bx+bw-10, by+bh); ctx.lineTo(bx+10, by+bh);
            ctx.closePath(); ctx.stroke();
            // basket weave lines
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2;
            for (var wi = 0; wi < 5; wi++) {
                ctx.beginPath(); ctx.moveTo(bx+wi*20, by); ctx.lineTo(bx+8+wi*14, by+bh); ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(bx, by+bh*0.45); ctx.lineTo(bx+bw, by+bh*0.45); ctx.stroke();
            // basket top highlight
            ctx.fillStyle = 'rgba(255,220,100,0.2)';
            ctx.fillRect(bx+2, by, bw-4, 7);
            // lives — heart shapes
            [10, 30, 50].forEach(function(hx) {
                var hy = 205;
                var heartG = ctx.createRadialGradient(hx+7, hy+3, 0, hx+8, hy+6, 10);
                heartG.addColorStop(0, '#ff8080');
                heartG.addColorStop(0.5, '#e74c3c');
                heartG.addColorStop(1, '#8b0000');
                ctx.fillStyle = heartG;
                ctx.beginPath();
                ctx.moveTo(hx+8, hy+4);
                ctx.bezierCurveTo(hx+8, hy-1, hx, hy-1, hx, hy+4);
                ctx.bezierCurveTo(hx, hy+11, hx+8, hy+15, hx+8, hy+19);
                ctx.bezierCurveTo(hx+8, hy+15, hx+16, hy+11, hx+16, hy+4);
                ctx.bezierCurveTo(hx+16, hy-1, hx+8, hy-1, hx+8, hy+4);
                ctx.fill();
                // heart highlight
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.ellipse(hx+5, hy+3, 3, 2, -0.5, 0, Math.PI*2); ctx.fill();
            });
            // score
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
            ctx.fillText('850 pts', W-6, 20);
        },

        /* ── PACMAN ─────────────────────────────────────────────────── */
        pacman: function (ctx) {
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#000820'); bgG.addColorStop(1, '#001040');
            ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

            function wall(x, y, w, h) {
                var wg = ctx.createLinearGradient(x, y, x+w, y+h);
                wg.addColorStop(0, '#2a4fa8'); wg.addColorStop(1, '#1a3a8a');
                roundRect(ctx, x, y, w, h, 4, wg);
                ctx.strokeStyle = 'rgba(100,150,255,0.28)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x+4, y+2); ctx.lineTo(x+w-4, y+2); ctx.stroke();
            }
            wall(0,0,W,14); wall(0,H-14,W,14); wall(0,0,14,H); wall(W-14,0,14,H);
            wall(28,28,44,14); wall(148,28,44,14);
            wall(28,80,14,58); wall(178,80,14,58);
            wall(80,54,60,14); wall(80,108,60,14); wall(80,155,60,14);
            wall(28,168,44,14); wall(148,168,44,14);

            // pellets
            ctx.fillStyle = '#e8d870';
            [[55,21],[110,21],[165,21],[21,55],[21,110],[21,165],[199,55],[199,110],[199,165],
             [55,200],[110,200],[165,200],[55,68],[165,68],[55,148],[165,148],[55,118],[165,118]
            ].forEach(function(p){ ctx.beginPath(); ctx.arc(p[0],p[1],2.5,0,Math.PI*2); ctx.fill(); });

            // power pellets
            [[35,35],[185,35],[35,185],[185,185]].forEach(function(p) {
                var pg = ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],10);
                pg.addColorStop(0,'#fff9c4'); pg.addColorStop(0.5,'#ffe566'); pg.addColorStop(1,'rgba(255,200,0,0)');
                ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(p[0],p[1],10,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffe566'; ctx.beginPath(); ctx.arc(p[0],p[1],6,0,Math.PI*2); ctx.fill();
            });

            // Pacman
            var px = 110, py = 118, ma = 0.3;
            var pacG = ctx.createRadialGradient(px-3,py-3,1,px,py,18);
            pacG.addColorStop(0,'#fff176'); pacG.addColorStop(0.4,'#ffd600'); pacG.addColorStop(1,'#f9a825');
            ctx.fillStyle = pacG;
            ctx.beginPath(); ctx.moveTo(px,py); ctx.arc(px,py,18,ma,Math.PI*2-ma); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#000820'; ctx.beginPath(); ctx.arc(px+5,py-8,2.5,0,Math.PI*2); ctx.fill();

            // Ghost (Blinky — red)
            var gx = 80, gy = 84;
            var ghostG = ctx.createLinearGradient(gx-12,gy-18,gx+12,gy+18);
            ghostG.addColorStop(0,'#ff6b6b'); ghostG.addColorStop(0.5,'#e53935'); ghostG.addColorStop(1,'#b71c1c');
            ctx.fillStyle = ghostG;
            ctx.beginPath(); ctx.arc(gx,gy-6,12,Math.PI,0); ctx.lineTo(gx+12,gy+14);
            ctx.quadraticCurveTo(gx+8,gy+10,gx+4,gy+14); ctx.quadraticCurveTo(gx,gy+10,gx-4,gy+14);
            ctx.quadraticCurveTo(gx-8,gy+10,gx-12,gy+14); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(gx-4,gy-6,4,5,0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(gx+4,gy-6,4,5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1565c0';
            ctx.beginPath(); ctx.arc(gx-3,gy-5,2.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+5,gy-5,2.5,0,Math.PI*2); ctx.fill();

            ctx.fillStyle = '#ffe566'; ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            ctx.fillText('1UP  1480', W-14, 16); ctx.textBaseline = 'alphabetic';
        },

        /* ── BUBBLE SHOOTER ─────────────────────────────────────────── */
        bubbleshooter: function (ctx) {
            var bgG = ctx.createLinearGradient(0,0,0,H);
            bgG.addColorStop(0,'#0a0a1e'); bgG.addColorStop(1,'#121228');
            ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

            var bColors = [
                {l:'#ff5252',b:'#e53935',d:'#b71c1c'},
                {l:'#42a5f5',b:'#1e88e5',d:'#0d47a1'},
                {l:'#66bb6a',b:'#43a047',d:'#1b5e20'},
                {l:'#ffee58',b:'#fdd835',d:'#f57f17'},
                {l:'#ab47bc',b:'#8e24aa',d:'#4a148c'},
                {l:'#ffa726',b:'#fb8c00',d:'#e65100'},
            ];
            function bubble(x, y, r, ci) {
                var c = bColors[ci % 6];
                var bg = ctx.createRadialGradient(x-r*0.35,y-r*0.35,0,x,y,r);
                bg.addColorStop(0,c.l); bg.addColorStop(0.5,c.b); bg.addColorStop(1,c.d);
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.38)';
                ctx.beginPath(); ctx.ellipse(x-r*0.28,y-r*0.3,r*0.28,r*0.2,-0.5,0,Math.PI*2); ctx.fill();
            }
            var R = 18, pattern = [[0,1,2,3,4,5],[3,4,5,0,1,2],[1,2,3,4,5,0],[5,0,1,2,3,4],[2,3,4,5,0,1]];
            for (var row = 0; row < 5; row++) {
                var off = (row%2) ? R : 0;
                for (var col = 0; col < 6; col++) {
                    var bx = off + R + col*R*2, by = 16 + row*R*1.72 + R;
                    if (bx+R < W-2) bubble(bx, by, R-2, pattern[row][col]);
                }
            }
            bubble(110, 138, R-3, 3); // flying bubble

            ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([4,7]);
            ctx.beginPath(); ctx.moveTo(110,208); ctx.lineTo(110,152); ctx.stroke();
            ctx.setLineDash([]);

            // cannon
            var cg = ctx.createLinearGradient(102,0,118,0);
            cg.addColorStop(0,'#555'); cg.addColorStop(0.5,'#888'); cg.addColorStop(1,'#444');
            roundRect(ctx, 103, 180, 14, 30, 5, cg);
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            roundRect(ctx, 105, 182, 5, 26, 3, 'rgba(255,255,255,0.14)');
            var baseG = ctx.createRadialGradient(110,212,0,110,212,22);
            baseG.addColorStop(0,'#555'); baseG.addColorStop(1,'#222');
            ctx.fillStyle = baseG; ctx.beginPath(); ctx.ellipse(110,214,22,9,0,0,Math.PI*2); ctx.fill();

            bubble(22, 200, R-5, 1);
            ctx.fillStyle = '#666'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('NEXT', 22, 218); ctx.textAlign = 'left';
        },

        /* ── HANGMAN ────────────────────────────────────────────────── */
        hangman: function (ctx) {
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
        },

        /* ── CAR RACE ───────────────────────────────────────────────── */
        carrace: function (ctx) {
            var bgG = ctx.createLinearGradient(0,0,0,H);
            bgG.addColorStop(0,'#1b3a1b'); bgG.addColorStop(1,'#0e1e0e');
            ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);
            for (var gi = 0; gi < 14; gi++) {
                ctx.fillStyle = gi%2===0 ? 'rgba(60,110,60,0.25)' : 'rgba(40,80,40,0.15)';
                ctx.fillRect(0, gi*16, W, 16);
            }

            var rx = 52, rw = 116;
            ctx.fillStyle = '#242424'; ctx.fillRect(rx,0,rw,H);
            ctx.fillStyle = '#ffd600'; ctx.fillRect(rx,0,3,H); ctx.fillRect(rx+rw-3,0,3,H);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
            ctx.setLineDash([22,12]);
            ctx.beginPath(); ctx.moveTo(rx+rw/2,0); ctx.lineTo(rx+rw/2,H); ctx.stroke();
            ctx.setLineDash([]);

            function car(cx, cy, b0, b1, rf) {
                var cw=26, ch=50;
                ctx.fillStyle = 'rgba(0,0,0,0.28)';
                ctx.beginPath(); ctx.ellipse(cx,cy+ch/2+4,12,5,0,0,Math.PI*2); ctx.fill();
                var bg = ctx.createLinearGradient(cx-cw/2,0,cx+cw/2,0);
                bg.addColorStop(0,b0); bg.addColorStop(0.5,b1); bg.addColorStop(1,b0);
                roundRect(ctx,cx-cw/2,cy-ch/2,cw,ch,5,bg);
                ctx.fillStyle = rf;
                roundRect(ctx,cx-cw/2+4,cy-ch/2+10,cw-8,ch*0.5,3,rf);
                ctx.fillStyle = 'rgba(160,220,255,0.62)';
                roundRect(ctx,cx-cw/2+5,cy-ch/2+6,cw-10,12,2,'rgba(160,220,255,0.62)');
                roundRect(ctx,cx-cw/2+5,cy+ch/2-16,cw-10,11,2,'rgba(160,220,255,0.4)');
                ctx.fillStyle = '#0a0a0a';
                [[-cw/2-2,-ch/2+4],[cw/2-5,-ch/2+4],[-cw/2-2,ch/2-16],[cw/2-5,ch/2-16]].forEach(function(wp){
                    roundRect(ctx,cx+wp[0],cy+wp[1],7,13,2,'#0a0a0a');
                });
                ctx.fillStyle = '#fffde7';
                ctx.beginPath(); ctx.ellipse(cx-cw/2+5,cy-ch/2+3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx+cw/2-5,cy-ch/2+3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff1744';
                ctx.beginPath(); ctx.ellipse(cx-cw/2+5,cy+ch/2-3,3,2,0,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx+cw/2-5,cy+ch/2-3,3,2,0,0,Math.PI*2); ctx.fill();
            }

            car(rx+rw*0.27, 55,  '#1565c0','#1976d2','#0d47a1');
            car(rx+rw*0.73, 100, '#f9a825','#fbc02d','#e65100');
            car(rx+rw*0.27, 12,  '#546e7a','#607d8b','#37474f');
            car(rx+rw*0.5,  175, '#c62828','#e53935','#b71c1c');

            // coins
            [[rx+rw*0.5,130],[rx+rw*0.73,158]].forEach(function(p) {
                var cg2 = ctx.createRadialGradient(p[0]-2,p[1]-2,0,p[0],p[1],7);
                cg2.addColorStop(0,'#fff176'); cg2.addColorStop(0.5,'#ffd600'); cg2.addColorStop(1,'#f57f17');
                ctx.fillStyle = cg2; ctx.beginPath(); ctx.arc(p[0],p[1],7,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#fff176'; ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('$', p[0], p[1]);
            });

            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5;
            [65,82,100,118,135,152].forEach(function(lx2){
                ctx.beginPath(); ctx.moveTo(lx2,0); ctx.lineTo(lx2,20); ctx.stroke();
            });

            ctx.fillStyle = '#ffd600'; ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            ctx.fillText('LVL 3 · 1240', W-5, 5);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        },

        /* ── PLATFORMER ─────────────────────────────────────────────── */
        platformer: function (ctx) {
            var skyG = ctx.createLinearGradient(0,0,0,H);
            skyG.addColorStop(0,'#1a3a5c'); skyG.addColorStop(0.65,'#2a5f8a'); skyG.addColorStop(1,'#4a8ab5');
            ctx.fillStyle = skyG; ctx.fillRect(0,0,W,H);

            // background mountains
            ctx.fillStyle = 'rgba(26,55,85,0.55)';
            ctx.beginPath(); ctx.moveTo(0,H);
            [0,25,45,65,80,100,120,140,155,175,195,220].forEach(function(x,i){
                ctx.lineTo(x,[140,100,118,90,112,82,100,108,95,118,104,140][i]);
            });
            ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

            function platform(x, y, w, h) {
                var grassG = ctx.createLinearGradient(x,y,x,y+8);
                grassG.addColorStop(0,'#5cba4a'); grassG.addColorStop(1,'#3d8a30');
                ctx.fillStyle = grassG; ctx.fillRect(x,y,w,8);
                var dirtG = ctx.createLinearGradient(x,y+8,x,y+h);
                dirtG.addColorStop(0,'#8b5e3c'); dirtG.addColorStop(1,'#5a3820');
                ctx.fillStyle = dirtG; ctx.fillRect(x,y+8,w,h-8);
                ctx.fillStyle = 'rgba(180,255,100,0.18)'; ctx.fillRect(x+2,y,w-4,3);
            }
            platform(0,185,W,35);
            platform(18,148,66,20);
            platform(118,120,76,20);
            platform(58,90,56,18);
            platform(154,74,56,18);

            // stars (golden 5-pt)
            function star(sx, sy, r) {
                var sg = ctx.createRadialGradient(sx,sy,0,sx,sy,r);
                sg.addColorStop(0,'#fff9c4'); sg.addColorStop(0.5,'#ffd600'); sg.addColorStop(1,'#ff8f00');
                ctx.fillStyle = sg;
                ctx.beginPath();
                for (var si = 0; si < 5; si++) {
                    var a = si*Math.PI*2/5 - Math.PI/2;
                    var ia = a + Math.PI/5;
                    if (si===0) ctx.moveTo(sx+Math.cos(a)*r, sy+Math.sin(a)*r);
                    else ctx.lineTo(sx+Math.cos(a)*r, sy+Math.sin(a)*r);
                    ctx.lineTo(sx+Math.cos(ia)*r*0.42, sy+Math.sin(ia)*r*0.42);
                }
                ctx.closePath(); ctx.fill();
            }
            star(80,78,8); star(132,106,7); star(176,62,8); star(38,134,7); star(166,60,7);

            // enemy (red walker)
            var ex=132, ey=110;
            var eg = ctx.createLinearGradient(ex-10,ey-16,ex+10,ey);
            eg.addColorStop(0,'#ff5252'); eg.addColorStop(1,'#b71c1c');
            roundRect(ctx,ex-10,ey-16,20,16,4,eg);
            ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex-4,ey-10,3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex+4,ey-10,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(ex-3,ey-10,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(ex+5,ey-10,1.5,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#000'; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.moveTo(ex-7,ey-14); ctx.lineTo(ex-2,ey-12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex+2,ey-12); ctx.lineTo(ex+7,ey-14); ctx.stroke();
            ctx.fillStyle='#b71c1c'; ctx.fillRect(ex-8,ey,7,8); ctx.fillRect(ex+1,ey,7,8);

            // player hero (teal)
            var hx=42, hy=138;
            var hg = ctx.createLinearGradient(hx-8,hy-20,hx+8,hy);
            hg.addColorStop(0,'#4dd0e1'); hg.addColorStop(1,'#0097a7');
            roundRect(ctx,hx-8,hy-20,16,20,3,hg);
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.ellipse(hx-3,hy-13,2.5,3.5,0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(hx+3,hy-13,2.5,3.5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#000';
            ctx.beginPath(); ctx.arc(hx-3,hy-12,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(hx+3,hy-12,1.5,0,Math.PI*2); ctx.fill();
            var lg = ctx.createLinearGradient(hx-6,hy,hx+6,hy+10);
            lg.addColorStop(0,'#0097a7'); lg.addColorStop(1,'#006064');
            ctx.fillStyle=lg; ctx.fillRect(hx-7,hy,6,10); ctx.fillRect(hx+1,hy,6,10);

            ctx.fillStyle='#fff'; ctx.font='bold 10px monospace';
            ctx.textAlign='left'; ctx.textBaseline='top';
            ctx.fillText('LVL 2  430', 7, 5); ctx.textBaseline='alphabetic';
        },

        /* ── STACKTOWER ─────────────────────────────────────────────── */
        stacktower: function (ctx) {
            // cielo nocturno con degradado
            var skyG = ctx.createLinearGradient(0, 0, 0, H);
            skyG.addColorStop(0, '#0a1830');
            skyG.addColorStop(0.55, '#362068');
            skyG.addColorStop(1, '#b14c82');
            ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H);

            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (var i = 0; i < 28; i++) {
                var sx = (i * 53) % W;
                var sy = ((i * 97) % (H - 100)) + 8;
                ctx.fillRect(sx, sy, (i % 3 === 0) ? 2 : 1, (i % 3 === 0) ? 2 : 1);
            }

            // torre apilada (colores que van cambiando por HUE)
            function block(bx, by, bw, bh, hue) {
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.fillRect(bx + 3, by + bh - 4, bw, 5);
                var g = ctx.createLinearGradient(bx, by, bx, by + bh);
                g.addColorStop(0, 'hsl(' + hue + ',75%,68%)');
                g.addColorStop(1, 'hsl(' + hue + ',70%,38%)');
                ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = 'rgba(255,255,255,0.28)';
                ctx.fillRect(bx + 2, by + 2, Math.max(0, bw - 4), 3);
                ctx.strokeStyle = 'hsl(' + hue + ',80%,25%)';
                ctx.lineWidth = 1;
                ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
            }

            // la pila va estrechando hacia arriba
            var baseW = 140, baseX = (W - baseW) / 2, baseY = H - 30;
            var bh = 18;
            var widths = [140, 130, 122, 118, 110, 102, 94, 86, 78];
            var cx = W / 2;
            var cy = baseY;
            var hue = 200;
            for (var k = 0; k < widths.length; k++) {
                var ww = widths[k];
                // desviaciones suaves a izquierda/derecha para dar sensación de apilado
                var off = [0, 4, -3, 5, -4, 3, -2, 4, -3][k];
                block(cx - ww / 2 + off, cy, ww, bh, hue);
                cy -= bh;
                hue = (hue + 18) % 360;
            }

            // bloque activo (flotando)
            var ax = 40, ay = 40, aw = 70;
            block(ax, ay, aw, bh, (hue + 18) % 360);

            // flecha/indicador de movimiento
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.beginPath();
            ctx.moveTo(ax + aw + 10, ay + bh / 2);
            ctx.lineTo(ax + aw + 22, ay + bh / 2 - 7);
            ctx.lineTo(ax + aw + 22, ay + bh / 2 + 7);
            ctx.closePath(); ctx.fill();

            // partículas tipo "perfecto"
            ctx.fillStyle = 'rgba(255,224,102,0.95)';
            [[135, 78, 2], [150, 70, 3], [165, 82, 2], [120, 90, 2], [175, 95, 3]].forEach(function (p) {
                ctx.fillRect(p[0], p[1], p[2], p[2]);
            });

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Altura: 9', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 42', W - 8, 11);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        },

        /* ── CATAPULTA ──────────────────────────────────────────────── */
        catapulta: function (ctx) {
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

            // catapulta
            var SX = 46, SY = 152;
            ctx.fillStyle = '#4e3218'; ctx.fillRect(SX - 22, 164, 44, 8);
            ctx.fillStyle = '#714922'; ctx.fillRect(SX - 22, 162, 44, 3);
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(SX - 14, 176, 7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(SX + 14, 176, 7, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#7a4e22'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(SX - 8, 164); ctx.lineTo(SX, SY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(SX + 8, 164); ctx.lineTo(SX, SY); ctx.stroke();
            ctx.fillStyle = '#9c6a30';
            ctx.beginPath(); ctx.ellipse(SX, SY, 10, 5, 0, 0, Math.PI * 2); ctx.fill();

            // proyectil (roca)
            var PX = 62, PY = 138;
            var prg = ctx.createRadialGradient(PX - 3, PY - 3, 1, PX, PY, 9);
            prg.addColorStop(0, '#e0d4b5');
            prg.addColorStop(0.5, '#867563');
            prg.addColorStop(1, '#3b322a');
            ctx.fillStyle = prg;
            ctx.beginPath(); ctx.arc(PX, PY, 9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1; ctx.stroke();

            // gomas del tirachinas
            ctx.strokeStyle = '#c96c3c'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(SX - 8, SY - 3); ctx.lineTo(PX - 2, PY + 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(SX + 8, SY - 3); ctx.lineTo(PX + 2, PY + 2); ctx.stroke();

            // trayectoria punteada (parábola)
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            var arcPts = [
                [82, 125], [100, 110], [118, 98],
                [136, 90], [154, 85], [172, 85],
                [190, 92]
            ];
            arcPts.forEach(function (p, idx) {
                var s = idx % 2 === 0 ? 2 : 2;
                ctx.fillRect(p[0] - 1, p[1] - 1, s, s);
            });

            // castillo objetivo 1 (grande con bandera)
            function drawCastle(tx, ty, tw, th, hue) {
                var cg = ctx.createLinearGradient(tx, ty, tx, ty + th);
                cg.addColorStop(0, 'hsl(' + hue + ',55%,72%)');
                cg.addColorStop(1, 'hsl(' + hue + ',60%,40%)');
                ctx.fillStyle = cg; ctx.fillRect(tx, ty, tw, th);
                ctx.fillStyle = 'hsl(' + hue + ',60%,30%)';
                ctx.fillRect(tx, ty + th - 3, tw, 3);
                var mW = 5, gap = 3, step = mW + gap;
                for (var m = 0; m < Math.floor(tw / step); m++) {
                    ctx.fillStyle = 'hsl(' + hue + ',55%,55%)';
                    ctx.fillRect(tx + 1 + m * step, ty - 5, mW, 5);
                }
                // ventana
                var wW = Math.min(9, tw * 0.35), wH = Math.min(12, th * 0.4);
                var wx = tx + (tw - wW) / 2, wy = ty + 6;
                ctx.fillStyle = '#231a14'; ctx.fillRect(wx, wy, wW, wH);
                ctx.fillStyle = 'hsl(42,90%,65%)';
                ctx.fillRect(wx + 1, wy + 1, wW - 2, wH - 6);
                // bandera
                ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(tx + tw / 2, ty - 5); ctx.lineTo(tx + tw / 2, ty - 16); ctx.stroke();
                ctx.fillStyle = 'hsl(' + ((hue + 180) % 360) + ',80%,58%)';
                ctx.beginPath();
                ctx.moveTo(tx + tw / 2, ty - 16);
                ctx.lineTo(tx + tw / 2 + 7, ty - 13);
                ctx.lineTo(tx + tw / 2, ty - 10);
                ctx.closePath(); ctx.fill();
            }
            drawCastle(192, 118, 40, 48, 200);
            drawCastle(152, 140, 28, 26, 340);

            // explosión en castillo derribado
            var EX = 162, EY = 135;
            for (var p = 0; p < 14; p++) {
                var ang = p * (Math.PI * 2 / 14);
                var rr  = 10 + (p % 3) * 4;
                ctx.fillStyle = (p % 2 === 0) ? '#ffd866' : '#ff6b4a';
                ctx.fillRect(EX + Math.cos(ang) * rr - 1, EY + Math.sin(ang) * rr - 1, 2, 2);
            }

            // viento (flecha) top-right
            ctx.strokeStyle = '#8fd3f4'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(158, 18); ctx.lineTo(188, 18); ctx.stroke();
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath();
            ctx.moveTo(188, 18); ctx.lineTo(183, 14); ctx.lineTo(183, 22);
            ctx.closePath(); ctx.fill();

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Nivel 2   Tiros:3', 6, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Viento', 150, 11);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        },

        /* ── HELICOIDAL ─────────────────────────────────────────────── */
        helicoidal: function (ctx) {
            // fondo: cielo cósmico con degradado vertical
            var sky = ctx.createLinearGradient(0, 0, 0, H);
            sky.addColorStop(0, '#120635');
            sky.addColorStop(0.55, '#2a1260');
            sky.addColorStop(1, '#601e8c');
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

            // estrellas
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            for (var i = 0; i < 36; i++) {
                var sx = (i * 61) % W;
                var sy = ((i * 37) % H);
                ctx.fillRect(sx, sy, (i % 4 === 0) ? 2 : 1, (i % 4 === 0) ? 2 : 1);
            }

            // poste central vertical
            var px = W / 2 - 10;
            var poleG = ctx.createLinearGradient(px, 0, px + 20, 0);
            poleG.addColorStop(0, '#100423');
            poleG.addColorStop(0.5, '#2a1644');
            poleG.addColorStop(1, '#100423');
            ctx.fillStyle = poleG; ctx.fillRect(px, 0, 20, H);
            ctx.fillStyle = 'rgba(255,255,255,0.09)';
            ctx.fillRect(px + 7, 0, 3, H);

            // discos elípticos apilados
            var cx = W / 2, rx = 95, ry = 14;
            var discs = [
                { y: 48,  rotOffset: 0.0,  palette: 'cyan',   reds: [2],    gaps: [6] },
                { y: 100, rotOffset: 0.35, palette: 'teal',   reds: [1, 5], gaps: [3] },
                { y: 160, rotOffset: 0.8,  palette: 'cyan',   reds: [0, 4], gaps: [7] },
                { y: 205, rotOffset: 1.15, palette: 'teal',   reds: [3],    gaps: [1, 5] },
            ];

            function drawWedge(cx, cy, rx, ry, a0, a1, fillGrad, alpha) {
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
                ctx.closePath();
                ctx.fillStyle = fillGrad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(10,4,30,0.6)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            discs.forEach(function (d) {
                for (var s = 0; s < 8; s++) {
                    var a0 = d.rotOffset + s * Math.PI / 4;
                    var a1 = a0 + Math.PI / 4;
                    var aMid = (a0 + a1) / 2;
                    var inFront = Math.sin(aMid) > 0;
                    var isGap = d.gaps.indexOf(s) >= 0;
                    var isRed = d.reds.indexOf(s) >= 0;
                    if (isGap) continue;
                    var g;
                    if (isRed) {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#ff7566');
                        g.addColorStop(1, '#a81e14');
                    } else if (d.palette === 'cyan') {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#6fd3ff');
                        g.addColorStop(1, '#2a74a8');
                    } else {
                        g = ctx.createLinearGradient(cx, d.y - ry, cx, d.y + ry);
                        g.addColorStop(0, '#7be0b3');
                        g.addColorStop(1, '#2e8a5d');
                    }
                    drawWedge(cx, d.y, rx, ry, a0, a1, g, inFront ? 1 : 0.65);
                }
                // anillo exterior sutil
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(cx, d.y, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            });

            // sombra bajo la bola (en el disco de nivel 160)
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx + 2, 158, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            // bola (rebotando sobre el disco medio-alto)
            var bx = cx, by = 135;
            var bg = ctx.createRadialGradient(bx - 4, by - 5, 1, bx, by, 16);
            bg.addColorStop(0, '#ffd866');
            bg.addColorStop(0.55, '#ff9f45');
            bg.addColorStop(1, '#8f1a06');
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.arc(bx - 4, by - 5, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a0e04';
            ctx.fillRect(bx + 3, by - 1, 2, 2);

            // partículas de rebote (amarillas)
            ctx.fillStyle = '#ffd866';
            [[cx - 10, 148], [cx + 14, 150], [cx - 18, 154], [cx + 20, 146], [cx - 4, 158]].forEach(function (p) {
                ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
            });

            // indicador de rotación (flechas circulares debajo)
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(W / 2, H - 30, 22, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.moveTo(W / 2 - 22, H - 38);
            ctx.lineTo(W / 2 - 32, H - 30);
            ctx.lineTo(W / 2 - 22, H - 22);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(W / 2 + 22, H - 38);
            ctx.lineTo(W / 2 + 32, H - 30);
            ctx.lineTo(W / 2 + 22, H - 22);
            ctx.closePath(); ctx.fill();

            // HUD
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Puntos: 12', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 48', W - 8, 11);
            ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

            // Combo flash
            ctx.fillStyle = '#ffd866';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('x3', W / 2, 42);
            ctx.textAlign = 'left';
        },

        /* ── RITMO ──────────────────────────────────────────────────── */
        ritmo: function (ctx) {
            // fondo degradado púrpura/azul estilo escenario nocturno
            var bgG = ctx.createLinearGradient(0, 0, 0, H);
            bgG.addColorStop(0, '#130738');
            bgG.addColorStop(0.55, '#2a0d5a');
            bgG.addColorStop(1, '#090218');
            ctx.fillStyle = bgG;
            ctx.fillRect(0, 0, W, H);

            // estrellas sutiles
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            var stars = [[20,18],[48,52],[90,30],[140,70],[180,22],[210,60],
                         [40,100],[110,120],[170,130],[200,150]];
            stars.forEach(function (s) { ctx.fillRect(s[0], s[1], 1, 1); });

            // 4 carriles con líneas suaves
            var laneW = W / 4;
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (var l = 1; l < 4; l++) {
                ctx.beginPath();
                ctx.moveTo(l * laneW, 0);
                ctx.lineTo(l * laneW, H);
                ctx.stroke();
            }

            // banda de zona de golpe (glow translúcido)
            var hitY = H - 52;
            ctx.fillStyle = 'rgba(143,211,244,0.25)';
            ctx.fillRect(0, hitY - 22, W, 44);

            // línea de impacto brillante
            ctx.strokeStyle = '#8fd3f4';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, hitY);
            ctx.lineTo(W, hitY);
            ctx.stroke();
            ctx.fillStyle = '#8fd3f4';
            ctx.beginPath(); ctx.arc(6, hitY, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(W - 6, hitY, 3, 0, Math.PI * 2); ctx.fill();

            // paletas de tiles por carril
            var palettes = [
                { a: '#ff7ad9', b: '#a8247d' },   // rosa
                { a: '#ffd866', b: '#c27a11' },   // oro
                { a: '#7bf0c6', b: '#1e8a64' },   // turquesa
                { a: '#8fb4ff', b: '#2b4fa8' }    // azul
            ];

            // bloques cayendo en cada carril a distinta altura
            var blocks = [
                { lane: 0, y: 40,  h: 48 },
                { lane: 1, y: 90,  h: 48 },
                { lane: 2, y: hitY - 24, h: 48 }, // justo sobre la línea — "a punto de tocar"
                { lane: 3, y: 150, h: 48 }
            ];
            blocks.forEach(function (b) {
                var x = b.lane * laneW + 6;
                var w = laneW - 12;
                var pal = palettes[b.lane];
                // cuerpo con gradiente vertical
                var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
                g.addColorStop(0, pal.a);
                g.addColorStop(1, pal.b);
                roundRect(ctx, x, b.y, w, b.h, 10, g, 'rgba(255,255,255,0.35)');
                // highlight superior
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                roundRect(ctx, x + 4, b.y + 4, w - 8, 8, 5, 'rgba(255,255,255,0.25)');
                // onda de sonido decorativa
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                var midY = b.y + b.h * 0.68;
                ctx.moveTo(x + 8, midY);
                ctx.lineTo(x + w * 0.28, midY - 5);
                ctx.lineTo(x + w * 0.5,  midY + 5);
                ctx.lineTo(x + w * 0.72, midY - 5);
                ctx.lineTo(x + w - 8, midY);
                ctx.stroke();
            });

            // pulso/flash en el carril 2 (el que "acaba de acertarse")
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = palettes[2].a;
            ctx.fillRect(2 * laneW, 0, laneW, H);
            ctx.globalAlpha = 1;

            // anillo expansivo en la línea de impacto
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(2 * laneW + laneW / 2, hitY, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(2 * laneW + laneW / 2, hitY, 36, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // HUD superior
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, 22);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('Puntos: 24', 8, 11);
            ctx.textAlign = 'right';
            ctx.fillText('Récord: 97', W - 8, 11);

            // combo en el centro
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd866';
            ctx.font = 'bold 18px monospace';
            ctx.fillText('x4', W / 2, 40);

            // corazones de vida (esquina derecha bajo HUD)
            function tinyHeart(hx, hy, on) {
                var sz = 10;
                ctx.fillStyle = on ? '#ff5a7a' : '#3a1c2a';
                ctx.beginPath();
                ctx.moveTo(hx, hy + sz * 0.3);
                ctx.bezierCurveTo(hx, hy, hx - sz * 0.55, hy, hx - sz * 0.55, hy + sz * 0.35);
                ctx.bezierCurveTo(hx - sz * 0.55, hy + sz * 0.65, hx, hy + sz * 0.85, hx, hy + sz);
                ctx.bezierCurveTo(hx, hy + sz * 0.85, hx + sz * 0.55, hy + sz * 0.65, hx + sz * 0.55, hy + sz * 0.35);
                ctx.bezierCurveTo(hx + sz * 0.55, hy, hx, hy, hx, hy + sz * 0.3);
                ctx.closePath();
                ctx.fill();
            }
            tinyHeart(W - 12, 30, true);
            tinyHeart(W - 28, 30, true);
            tinyHeart(W - 44, 30, false);

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        },
    };

    /* ── render all thumbnails on DOMContentLoaded ── */
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('canvas[data-game]').forEach(function (canvas) {
            var key = canvas.getAttribute('data-game');
            var fn  = thumbs[key];
            if (!fn) return;
            canvas.width  = W;
            canvas.height = H;
            var ctx = canvas.getContext('2d');
            try { fn(ctx); } catch (e) { console.warn('Thumbnail error for', key, e); }
        });
    });
}());

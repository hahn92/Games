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
            gradBg(ctx, '#0d1b2a', '#1b4332');
            // grid
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            for (var i = 0; i <= W; i += 20) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
            }
            // snake body
            var seg = [
                [6,6],[5,6],[4,6],[3,6],[3,7],[3,8],[4,8],[5,8],[5,9],[5,10],
                [5,11],[4,11],[3,11],[2,11]
            ];
            seg.forEach(function (s, i) {
                var x = s[0]*20+1, y = s[1]*20+1, sz = 18;
                var g = ctx.createRadialGradient(x+sz/2,y+sz/2,0,x+sz/2,y+sz/2,sz);
                g.addColorStop(0, i===0 ? '#69db7c' : '#2f9e44');
                g.addColorStop(1, i===0 ? '#2f9e44' : '#1b4332');
                roundRect(ctx, x, y, sz, sz, 4, g);
            });
            // eye
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(6*20+14, 6*20+7, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(6*20+15, 6*20+7, 1.5, 0, Math.PI*2); ctx.fill();
            // apple
            ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.arc(9*20+10, 3*20+10, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#40c057'; ctx.fillRect(9*20+10, 3*20+2, 2, 5);
        },

        /* ── TETRIS ─────────────────────────────────────────────────── */
        tetris: function (ctx) {
            background(ctx, '#0d0d0d');
            var colors = ['#e64980','#f03e3e','#fd7e14','#fab005','#82c91e','#12b886','#228be6','#7950f2'];
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
            var bw = 20, bh = 18, ox = 10, oy = 2;
            board.forEach(function (row, r) {
                row.forEach(function (v, c) {
                    if (!v) return;
                    var x = ox + c*bw, y = oy + r*bh;
                    ctx.fillStyle = colors[v-1];
                    ctx.fillRect(x+1, y+1, bw-2, bh-2);
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.fillRect(x+1, y+1, bw-2, 4);
                });
            });
        },

        /* ── PONG ───────────────────────────────────────────────────── */
        pong: function (ctx) {
            background(ctx, '#000');
            // scores
            ctx.fillStyle = C.white; ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'right'; ctx.fillText('7', W/2-16, 52);
            ctx.textAlign = 'left';  ctx.fillText('3', W/2+16, 52);
            // centre dashes
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4;
            ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
            ctx.setLineDash([]);
            // paddles
            roundRect(ctx, 14, 60, 12, 70, 6, C.white);
            roundRect(ctx, W-26, 100, 12, 70, 6, C.white);
            // ball
            ctx.fillStyle = C.white;
            ctx.beginPath(); ctx.arc(130, 120, 9, 0, Math.PI*2); ctx.fill();
            // glow
            var g = ctx.createRadialGradient(130,120,0,130,120,20);
            g.addColorStop(0,'rgba(255,255,255,0.4)');
            g.addColorStop(1,'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(130,120,20,0,Math.PI*2); ctx.fill();
        },

        /* ── BREAKOUT ───────────────────────────────────────────────── */
        breakout: function (ctx) {
            background(ctx, '#111');
            var rows = ['#e03131','#e8590c','#f59f00','#2f9e44','#1971c2','#9c36b5'];
            var bw = 33, bh = 14, gap = 2, ox = 4, oy = 16;
            rows.forEach(function (col, r) {
                for (var c = 0; c < 6; c++) {
                    roundRect(ctx, ox+c*(bw+gap), oy+r*(bh+gap), bw, bh, 3, col);
                    ctx.fillStyle='rgba(255,255,255,0.2)';
                    ctx.fillRect(ox+c*(bw+gap)+2, oy+r*(bh+gap)+2, bw-4, 4);
                }
            });
            // ball trail
            [[80,155,0.15],[90,148,0.25],[100,140,0.5]].forEach(function(b){
                ctx.fillStyle='rgba(255,255,255,'+b[2]+')';
                ctx.beginPath(); ctx.arc(b[0],b[1],6,0,Math.PI*2); ctx.fill();
            });
            ctx.fillStyle=C.white; ctx.beginPath(); ctx.arc(110,132,8,0,Math.PI*2); ctx.fill();
            roundRect(ctx, 68, 196, 80, 12, 6, C.blue);
        },

        /* ── 2048 ───────────────────────────────────────────────────── */
        '2048': function (ctx) {
            background(ctx, '#faf8ef');
            ctx.fillStyle = '#bbada0'; roundRect(ctx, 10,10,200,200,8,'#bbada0');
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
                    var x=14+c*48,y=14+r*48,s=44;
                    roundRect(ctx,x,y,s,s,4,tileColors[v]||'#3c3a32');
                    ctx.fillStyle = textColors[v]||'#f9f6f2';
                    ctx.font = 'bold '+(v<100?18:v<1000?14:11)+'px Arial';
                    ctx.textAlign='center'; ctx.textBaseline='middle';
                    ctx.fillText(v,x+s/2,y+s/2);
                });
            });
            ctx.textBaseline='alphabetic';
        },

        /* ── MEMORAMA ───────────────────────────────────────────────── */
        memorama: function (ctx) {
            gradBg(ctx,'#1a1a2e','#16213e');
            var symbols = ['★','♥','♦','♣','◆','✿','☀','♪'];
            var cols = 4, rows = 4, cw = 48, ch = 48, ox = 10, oy = 10;
            var revealed = [3, 7];
            for (var i = 0; i < 16; i++) {
                var cx2 = ox+(i%cols)*(cw+4), cy2 = oy+Math.floor(i/cols)*(ch+4);
                if (revealed.indexOf(i) >= 0) {
                    roundRect(ctx, cx2, cy2, cw, ch, 6, '#2d6a4f');
                    ctx.fillStyle = '#52b788'; ctx.font='bold 22px serif';
                    ctx.textAlign='center'; ctx.textBaseline='middle';
                    ctx.fillText(symbols[i%symbols.length], cx2+cw/2, cy2+ch/2);
                } else {
                    var g = ctx.createLinearGradient(cx2,cy2,cx2+cw,cy2+ch);
                    g.addColorStop(0,'#1971c2'); g.addColorStop(1,'#0c8599');
                    roundRect(ctx, cx2, cy2, cw, ch, 6, g);
                    // pattern
                    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
                    ctx.beginPath(); ctx.moveTo(cx2+6,cy2+6); ctx.lineTo(cx2+cw-6,cy2+ch-6); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(cx2+cw-6,cy2+6); ctx.lineTo(cx2+6,cy2+ch-6); ctx.stroke();
                }
            }
            ctx.textBaseline='alphabetic';
        },

        /* ── FLAPPY BIRD ────────────────────────────────────────────── */
        flappybird: function (ctx) {
            // sky
            var sky = ctx.createLinearGradient(0,0,0,H);
            sky.addColorStop(0,'#4ec0ca'); sky.addColorStop(1,'#87CEEB');
            ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
            // clouds
            ctx.fillStyle='rgba(255,255,255,0.8)';
            [[30,40,30],[120,28,20],[170,55,22]].forEach(function(cl){
                ctx.beginPath(); ctx.arc(cl[0],cl[1],cl[2],0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]-15,cl[1]+8,cl[2]-8,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(cl[0]+15,cl[1]+8,cl[2]-8,0,Math.PI*2); ctx.fill();
            });
            // pipes
            var pipeColor='#73c42f', pipeDark='#5a9e24';
            [[60,0,80],[60,130,H],[160,0,60],[160,150,H]].forEach(function(p,i){
                ctx.fillStyle=pipeColor; ctx.fillRect(p[0],p[1],44,p[2]-p[1]);
                ctx.fillStyle=pipeDark;
                if(i%2===0){ ctx.fillRect(p[0]-4,p[2]-20,52,20); }
                else { ctx.fillRect(p[0]-4,p[1],52,20); }
            });
            // ground
            ctx.fillStyle='#c8a96e'; ctx.fillRect(0,H-24,W,24);
            ctx.fillStyle='#73c42f'; ctx.fillRect(0,H-28,W,8);
            // bird
            var bx=115, by=95;
            ctx.fillStyle='#f9c23c';
            ctx.beginPath(); ctx.ellipse(bx,by,16,13,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(bx+6,by-4,6,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#1a1a1a';
            ctx.beginPath(); ctx.arc(bx+8,by-4,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#e8590c';
            ctx.beginPath(); ctx.moveTo(bx+12,by+1); ctx.lineTo(bx+22,by-2); ctx.lineTo(bx+12,by+5); ctx.fill();
            // wing
            ctx.fillStyle='#f08c00';
            ctx.beginPath(); ctx.ellipse(bx-4,by+3,8,5,-0.4,0,Math.PI*2); ctx.fill();
        },

        /* ── SPACE INVADERS ─────────────────────────────────────────── */
        spaceinvaders: function (ctx) {
            background(ctx,'#000');
            // stars
            ctx.fillStyle='#fff';
            [[15,10],[50,25],[90,8],[130,18],[175,5],[200,30],[30,50],[80,45],[150,35],[210,20]].forEach(function(s){
                ctx.fillRect(s[0],s[1],2,2);
            });
            // aliens row A (cyan)
            var alienA = [[40,30],[80,30],[120,30],[160,30],[200,30]];
            alienA.forEach(function(a){
                ctx.fillStyle='#00e5ff';
                ctx.fillRect(a[0]-10,a[1],20,4);
                ctx.fillRect(a[0]-8,a[1]+4,16,8);
                ctx.fillRect(a[0]-12,a[1]+8,6,4);
                ctx.fillRect(a[0]+6,a[1]+8,6,4);
                ctx.fillRect(a[0]-6,a[1]+12,4,4);
                ctx.fillRect(a[0]+2,a[1]+12,4,4);
            });
            // aliens row B (magenta)
            [[40,60],[80,60],[120,60],[160,60],[200,60]].forEach(function(a){
                ctx.fillStyle='#f06292';
                ctx.fillRect(a[0]-8,a[1],16,4);
                ctx.fillRect(a[0]-10,a[1]+4,20,8);
                ctx.fillRect(a[0]-12,a[1]+8,4,4);
                ctx.fillRect(a[0]+8,a[1]+8,4,4);
                ctx.fillRect(a[0]-4,a[1]+12,8,4);
            });
            // row C (orange)
            [[60,90],[120,90],[180,90]].forEach(function(a){
                ctx.fillStyle='#ffb74d';
                ctx.fillRect(a[0]-10,a[1]+4,20,8);
                ctx.fillRect(a[0]-14,a[1],4,8);
                ctx.fillRect(a[0]+10,a[1],4,8);
                ctx.fillRect(a[0]-6,a[1]+12,4,6);
                ctx.fillRect(a[0]+2,a[1]+12,4,6);
            });
            // bunkers
            [40,90,140,190].forEach(function(bx){
                ctx.fillStyle='#4caf50';
                ctx.fillRect(bx,160,30,18);
                ctx.clearRect(bx+2,170,8,8); ctx.clearRect(bx+20,170,8,8);
            });
            // player ship
            ctx.fillStyle='#8fd3f4';
            ctx.fillRect(98,192,24,8);
            ctx.fillRect(106,184,8,10);
            // bullet
            ctx.fillStyle='#fff'; ctx.fillRect(109,140,2,16);
        },

        /* ── WHACK-A-MOLE ───────────────────────────────────────────── */
        whackamole: function (ctx) {
            gradBg(ctx,'#2d6a4f','#1b4332');
            // dirt holes + moles
            var holes = [[55,70],[165,70],[55,150],[165,150],[110,110]];
            holes.forEach(function(h,i){
                // hole shadow
                ctx.fillStyle='rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.ellipse(h[0],h[1]+5,26,10,0,0,Math.PI*2); ctx.fill();
                if(i===2||i===4){
                    // mole body
                    ctx.fillStyle='#795548';
                    ctx.beginPath(); ctx.ellipse(h[0],h[1]-5,22,28,0,0,Math.PI); ctx.fill();
                    // face
                    ctx.fillStyle='#a1887f';
                    ctx.beginPath(); ctx.ellipse(h[0],h[1]-12,14,16,0,0,Math.PI*2); ctx.fill();
                    // eyes
                    ctx.fillStyle='#111';
                    ctx.beginPath(); ctx.arc(h[0]-6,h[1]-16,3,0,Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(h[0]+6,h[1]-16,3,0,Math.PI*2); ctx.fill();
                    // nose
                    ctx.fillStyle='#e91e63';
                    ctx.beginPath(); ctx.arc(h[0],h[1]-10,4,0,Math.PI*2); ctx.fill();
                    if(i===4){
                        // hammer
                        ctx.fillStyle='#8d6e63';
                        ctx.save(); ctx.translate(h[0]+28,h[1]-30); ctx.rotate(0.5);
                        ctx.fillRect(-5,-20,10,24); ctx.restore();
                        roundRect(ctx,h[0]+28,h[1]-52,22,16,3,'#bf360c');
                    }
                }
            });
            // grass
            ctx.fillStyle='#40916c';
            ctx.fillRect(0,190,W,30);
            [30,70,110,150,190].forEach(function(x){
                ctx.fillStyle='#52b788';
                ctx.beginPath();
                ctx.moveTo(x,190); ctx.lineTo(x-8,172); ctx.lineTo(x,180);
                ctx.lineTo(x+8,172); ctx.closePath(); ctx.fill();
            });
        },

        /* ── SIMON ──────────────────────────────────────────────────── */
        simon: function (ctx) {
            background(ctx,'#111');
            // 4 quadrants
            var quads = [
                {col:'#2ecc71',dark:'#1a7a43',x:0,y:0,a:Math.PI,b:1.5*Math.PI},
                {col:'#e74c3c',dark:'#8e1a10',x:W,y:0,a:1.5*Math.PI,b:2*Math.PI},
                {col:'#f39c12',dark:'#8a5700',x:0,y:H,a:0.5*Math.PI,b:Math.PI},
                {col:'#3498db',dark:'#1a5c8a',x:W,y:H,a:0,b:0.5*Math.PI},
            ];
            // highlight one (active)
            var active = 1;
            quads.forEach(function(q,i){
                ctx.beginPath();
                ctx.moveTo(W/2,H/2);
                ctx.arc(W/2,H/2,105,q.a,q.b);
                ctx.closePath();
                ctx.fillStyle = i===active ? q.col : q.dark;
                ctx.fill();
                if(i===active){
                    ctx.fillStyle='rgba(255,255,255,0.3)';
                    ctx.beginPath(); ctx.arc(W/2,H/2,105,q.a,q.b); ctx.lineTo(W/2,H/2); ctx.fill();
                }
            });
            // centre circle
            ctx.fillStyle='#111';
            ctx.beginPath(); ctx.arc(W/2,H/2,40,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#333'; ctx.lineWidth=6;
            ctx.beginPath(); ctx.moveTo(W/2,H/2-105); ctx.lineTo(W/2,H/2+105); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W/2-105,H/2); ctx.lineTo(W/2+105,H/2); ctx.stroke();
            // logo text
            ctx.fillStyle=C.white; ctx.font='bold 18px sans-serif'; ctx.textAlign='center';
            ctx.fillText('SIMON', W/2, H/2+7);
        },

        /* ── RUNNER ─────────────────────────────────────────────────── */
        runner: function (ctx) {
            var sky = ctx.createLinearGradient(0,0,0,H);
            sky.addColorStop(0,'#1a1a2e'); sky.addColorStop(1,'#4a4e69');
            ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
            // stars
            ctx.fillStyle='rgba(255,255,255,0.7)';
            [[20,20],[60,15],[100,30],[150,12],[190,22],[35,45],[80,50],[130,40]].forEach(function(s){
                ctx.fillRect(s[0],s[1],2,2);
            });
            // moon
            ctx.fillStyle='#ffe066'; ctx.beginPath(); ctx.arc(185,25,12,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#4a4e69'; ctx.beginPath(); ctx.arc(190,22,10,0,Math.PI*2); ctx.fill();
            // ground
            ctx.fillStyle='#e9c46a'; ctx.fillRect(0,162,W,58);
            ctx.fillStyle='#8b7355'; ctx.fillRect(0,162,W,4);
            // cactus 1
            ctx.fillStyle='#2a9d8f';
            ctx.fillRect(148,118,12,48); ctx.fillRect(136,130,24,8);
            ctx.fillRect(128,118,8,20); ctx.fillRect(168,125,8,20);
            // cactus 2 (small)
            ctx.fillRect(190,138,8,28); ctx.fillRect(184,145,16,6);
            // dino body
            var dx=55, dy=130;
            ctx.fillStyle='#4a9c6d';
            ctx.fillRect(dx,dy,32,28);
            ctx.fillRect(dx+18,dy-16,18,18); // head
            ctx.fillRect(dx+28,dy-10,10,6); // snout
            ctx.fillStyle='#fff'; ctx.fillRect(dx+30,dy-14,6,4);
            ctx.fillStyle='#111'; ctx.fillRect(dx+33,dy-14,3,3);
            // legs (run pose)
            ctx.fillStyle='#3a8c5d';
            ctx.fillRect(dx+4,dy+28,8,16); ctx.fillRect(dx+18,dy+28,8,8);
            // tail
            ctx.fillRect(dx-8,dy+8,12,8);
            // score
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='bold 14px monospace';
            ctx.textAlign='right'; ctx.fillText('01480', W-10, 20);
        },

        /* ── MINESWEEPER ────────────────────────────────────────────── */
        minesweeper: function (ctx) {
            background(ctx,'#c0c0c0');
            // cells
            var cell = 22, cols = 9, rows = 9, ox = 10, oy = 10;
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
            var numCols=['','#1565c0','#2e7d32','#c62828','#4a148c','#880e4f','#006064','#212121','#546e7a'];
            board.forEach(function(row,r){
                row.forEach(function(v,c){
                    var x=ox+c*cell, y=oy+r*cell;
                    if(v===-2){ // hidden
                        ctx.fillStyle='#bdbdbd'; ctx.fillRect(x,y,cell-1,cell-1);
                        ctx.fillStyle='#fff'; ctx.fillRect(x,y,cell-1,2); ctx.fillRect(x,y,2,cell-1);
                        ctx.fillStyle='#9e9e9e'; ctx.fillRect(x+cell-2,y,1,cell-1); ctx.fillRect(x,y+cell-2,cell-1,1);
                    } else if(v===-1){ // mine exploded
                        ctx.fillStyle='#f44336'; ctx.fillRect(x,y,cell-1,cell-1);
                        ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(x+cell/2,y+cell/2,6,0,Math.PI*2); ctx.fill();
                        for(var i=0;i<8;i++){
                            var a=i*Math.PI/4;
                            ctx.beginPath(); ctx.moveTo(x+cell/2,y+cell/2);
                            ctx.lineTo(x+cell/2+Math.cos(a)*9,y+cell/2+Math.sin(a)*9);
                            ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.stroke();
                        }
                    } else {
                        ctx.fillStyle='#e0e0e0'; ctx.fillRect(x,y,cell-1,cell-1);
                        ctx.fillStyle='#bdbdbd'; ctx.fillRect(x,y,cell-1,1); ctx.fillRect(x,y,1,cell-1);
                        if(v>0){
                            ctx.fillStyle=numCols[v]; ctx.font='bold 12px sans-serif';
                            ctx.textAlign='center'; ctx.textBaseline='middle';
                            ctx.fillText(v, x+cell/2, y+cell/2);
                        }
                    }
                });
            });
            // flag
            var fx=ox+7*cell, fy=oy+4*cell;
            ctx.fillStyle='#e0e0e0'; ctx.fillRect(fx,fy,cell-1,cell-1);
            ctx.fillStyle='#f44336';
            ctx.beginPath(); ctx.moveTo(fx+7,fy+4); ctx.lineTo(fx+18,fy+8); ctx.lineTo(fx+7,fy+12); ctx.fill();
            ctx.fillStyle='#111'; ctx.fillRect(fx+6,fy+4,2,14); ctx.fillRect(fx+2,fy+18,12,2);
            ctx.textBaseline='alphabetic';
        },

        /* ── TIC-TAC-TOE ────────────────────────────────────────────── */
        tictactoe: function (ctx) {
            gradBg(ctx,'#1a237e','#283593');
            // grid
            ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=4; ctx.lineCap='round';
            [73,147].forEach(function(p){
                ctx.beginPath(); ctx.moveTo(p,15); ctx.lineTo(p,205); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(15,p); ctx.lineTo(205,p); ctx.stroke();
            });
            // board state
            var board2 = [['X','O','X'],['O','X','O'],['O','','X']];
            board2.forEach(function(row,r){
                row.forEach(function(v,c){
                    var cx2=15+c*73+36, cy2=15+r*73+36;
                    if(v==='X'){
                        ctx.strokeStyle='#ef5350'; ctx.lineWidth=6;
                        ctx.beginPath(); ctx.moveTo(cx2-20,cy2-20); ctx.lineTo(cx2+20,cy2+20); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(cx2+20,cy2-20); ctx.lineTo(cx2-20,cy2+20); ctx.stroke();
                    } else if(v==='O'){
                        ctx.strokeStyle='#42a5f5'; ctx.lineWidth=6;
                        ctx.beginPath(); ctx.arc(cx2,cy2,20,0,Math.PI*2); ctx.stroke();
                    }
                });
            });
            // winning line (diagonal)
            ctx.strokeStyle='#ffee58'; ctx.lineWidth=5;
            ctx.setLineDash([8,4]);
            ctx.beginPath(); ctx.moveTo(51,51); ctx.lineTo(183,183); ctx.stroke();
            ctx.setLineDash([]);
        },

        /* ── CONNECT FOUR ───────────────────────────────────────────── */
        connectfour: function (ctx) {
            background(ctx,'#1565c0');
            // board holes
            for(var r=0;r<6;r++){
                for(var c=0;c<7;c++){
                    var cx2=16+c*29, cy2=16+r*29;
                    var disc = [
                        [0,1,0,1,0,1,0],
                        [1,0,1,0,1,0,0],
                        [0,1,2,1,2,0,0],
                        [1,0,1,2,1,0,0],
                        [0,1,0,0,2,0,0],
                        [1,2,2,1,2,1,2],
                    ];
                    var v = disc[r][c];
                    if(v===0){ ctx.fillStyle='#0d47a1'; }
                    else if(v===1){ // red
                        var g=ctx.createRadialGradient(cx2+6,cy2+4,0,cx2+10,cy2+10,16);
                        g.addColorStop(0,'#ef9a9a'); g.addColorStop(1,'#c62828');
                        ctx.fillStyle=g;
                    } else { // yellow
                        var g2=ctx.createRadialGradient(cx2+6,cy2+4,0,cx2+10,cy2+10,16);
                        g2.addColorStop(0,'#fff9c4'); g2.addColorStop(1,'#f9a825');
                        ctx.fillStyle=g2;
                    }
                    ctx.beginPath(); ctx.arc(cx2+10,cy2+10,12,0,Math.PI*2);
                    ctx.fill();
                }
            }
            // win highlight
            [[3,3],[3,4],[3,5],[3,6]].forEach(function(pos){
                ctx.strokeStyle='#fff'; ctx.lineWidth=3;
                ctx.beginPath(); ctx.arc(16+pos[1]*29+10, 16+pos[0]*29+10, 13,0,Math.PI*2); ctx.stroke();
            });
        },

        /* ── ASTEROIDS ──────────────────────────────────────────────── */
        asteroids: function (ctx) {
            background(ctx,'#000');
            // stars
            ctx.fillStyle='rgba(255,255,255,0.8)';
            [[10,15],[40,8],[80,20],[120,5],[160,18],[200,10],[25,50],[70,45],[130,38],[185,52],[50,80],[100,90],[170,75]].forEach(function(s){
                ctx.fillRect(s[0],s[1],Math.random()<0.3?2:1,Math.random()<0.3?2:1);
            });
            // asteroids (polygons)
            function asteroid(cx2,cy2,r,pts,col){
                ctx.strokeStyle=col||'#aaa'; ctx.lineWidth=2; ctx.fillStyle='rgba(100,100,100,0.3)';
                ctx.beginPath();
                for(var i=0;i<pts;i++){
                    var a=i*(2*Math.PI/pts), rr=r*(0.8+Math.sin(i*3)*0.2);
                    if(i===0) ctx.moveTo(cx2+Math.cos(a)*rr, cy2+Math.sin(a)*rr);
                    else ctx.lineTo(cx2+Math.cos(a)*rr, cy2+Math.sin(a)*rr);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            asteroid(60,60,38,8,'#9e9e9e');
            asteroid(170,80,24,7,'#9e9e9e');
            asteroid(130,165,18,6,'#9e9e9e');
            asteroid(40,155,14,5,'#757575');
            // fragments (broken asteroid)
            ctx.strokeStyle='#757575'; ctx.lineWidth=1.5;
            [[185,30,8],[200,45,6],[175,50,7]].forEach(function(f){
                asteroid(f[0],f[1],f[2],5,'#757575');
            });
            // player ship
            var sx=110,sy=120,sa=-Math.PI/2;
            ctx.strokeStyle='#8fd3f4'; ctx.lineWidth=2.5; ctx.fillStyle='rgba(143,211,244,0.15)';
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa)*22, sy+Math.sin(sa)*22);
            ctx.lineTo(sx+Math.cos(sa+2.4)*16, sy+Math.sin(sa+2.4)*16);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*8, sy+Math.sin(sa+Math.PI)*8);
            ctx.lineTo(sx+Math.cos(sa-2.4)*16, sy+Math.sin(sa-2.4)*16);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // thrust
            ctx.strokeStyle='#ff6b35'; ctx.lineWidth=2;
            ctx.beginPath();
            ctx.moveTo(sx+Math.cos(sa+2.4)*12,sy+Math.sin(sa+2.4)*12);
            ctx.lineTo(sx+Math.cos(sa+Math.PI)*20,sy+Math.sin(sa+Math.PI)*20);
            ctx.lineTo(sx+Math.cos(sa-2.4)*12,sy+Math.sin(sa-2.4)*12);
            ctx.stroke();
            // bullets
            ctx.strokeStyle='#fff'; ctx.lineWidth=2;
            [[sx,sy-45],[sx,sy-60]].forEach(function(b){
                ctx.beginPath(); ctx.moveTo(b[0],b[1]); ctx.lineTo(b[0],b[1]-8); ctx.stroke();
            });
        },

        /* ── FROGGER ────────────────────────────────────────────────── */
        frogger: function (ctx) {
            // safe zone (top)
            ctx.fillStyle='#1b4332'; ctx.fillRect(0,0,W,30);
            // river
            ctx.fillStyle='#1971c2'; ctx.fillRect(0,30,W,112);
            // logs
            ctx.fillStyle='#8b5e3c';
            [[0,38,80],[100,38,90],[10,62,70],[110,62,80],[0,86,90],[105,86,75]].forEach(function(l){
                roundRect(ctx,l[0],l[1],l[2],18,6,'#8b5e3c');
                ctx.strokeStyle='#6d4c41'; ctx.lineWidth=1;
                for(var i=0;i<l[2];i+=15){ ctx.beginPath(); ctx.moveTo(l[0]+i,l[1]+4); ctx.lineTo(l[0]+i,l[1]+14); ctx.stroke(); }
            });
            // road
            ctx.fillStyle='#424242'; ctx.fillRect(0,142,W,58);
            // road stripes
            ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=2; ctx.setLineDash([16,12]);
            [162,181,200].forEach(function(y){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); });
            ctx.setLineDash([]);
            // safe zone (bottom)
            ctx.fillStyle='#2d6a4f'; ctx.fillRect(0,200,W,20);
            // cars
            [
                {x:20,y:148,w:44,h:14,col:'#e53935'},
                {x:120,y:148,w:44,h:14,col:'#1e88e5'},
                {x:60,y:168,w:52,h:14,col:'#fdd835'},
                {x:10,y:188,w:38,h:12,col:'#43a047'},
            ].forEach(function(car){
                roundRect(ctx,car.x,car.y,car.w,car.h,4,car.col);
                ctx.fillStyle='rgba(255,255,255,0.5)';
                ctx.fillRect(car.x+4,car.y+3,8,car.h-6); ctx.fillRect(car.x+car.w-12,car.y+3,8,car.h-6);
            });
            // frog on log
            ctx.fillStyle='#69db7c';
            ctx.beginPath(); ctx.ellipse(50,47,12,9,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#2f9e44';
            ctx.beginPath(); ctx.ellipse(43,42,5,4,0.4,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(57,42,5,4,-0.4,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(44,43,2,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(56,43,2,0,Math.PI*2); ctx.fill();
            // lily pads (goal)
            [22,55,88,121,154].forEach(function(x){
                ctx.fillStyle='#2f9e44'; ctx.beginPath(); ctx.ellipse(x+12,15,12,7,0,0,Math.PI*2); ctx.fill();
            });
        },

        /* ── WORDLE ─────────────────────────────────────────────────── */
        wordle: function (ctx) {
            gradBg(ctx,'#1a1a2e','#16213e');
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
            var stateCol = ['#3a3a3c','#b59f3b','#538d4e'];
            var cw=36, ch=36, gap=6, ox=12, oy=8;
            grid.forEach(function(row,r){
                row.forEach(function(v,c){
                    var x=ox+c*(cw+gap), y=oy+r*(ch+gap);
                    var col = r<3 ? stateCol[states[r][c]] : '#242424';
                    roundRect(ctx,x,y,cw,ch,4,col,r>=3?'#3a3a3c':null);
                    if(v){
                        ctx.fillStyle='#fff'; ctx.font='bold 20px sans-serif';
                        ctx.textAlign='center'; ctx.textBaseline='middle';
                        ctx.fillText(v,x+cw/2,y+ch/2);
                    }
                });
            });
            ctx.textBaseline='alphabetic';
        },

        /* ── TYPING SPEED ───────────────────────────────────────────── */
        typingspeed: function (ctx) {
            gradBg(ctx,'#1a1a2e','#0f3460');
            // panel
            roundRect(ctx,14,30,192,160,12,'rgba(36,36,36,0.85)');
            // WPM
            var g=ctx.createLinearGradient(0,50,W,50);
            g.addColorStop(0,'#8fd3f4'); g.addColorStop(1,'#ff512f');
            ctx.fillStyle=g; ctx.font='bold 52px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('82', W/2, 85);
            ctx.fillStyle='#888'; ctx.font='11px sans-serif';
            ctx.fillText('PALABRAS / MIN', W/2, 110);
            // word
            ctx.fillStyle='#fff'; ctx.font='bold 26px monospace';
            ctx.fillText('RAPIDO', W/2, 148);
            // input underline
            ctx.strokeStyle=g; ctx.lineWidth=2;
            ctx.beginPath(); ctx.moveTo(34,160); ctx.lineTo(186,160); ctx.stroke();
            // timer bar bg
            roundRect(ctx,14,178,192,12,6,'#333');
            // timer bar fill
            var tg=ctx.createLinearGradient(14,0,206,0);
            tg.addColorStop(0,'#8fd3f4'); tg.addColorStop(1,'#ff512f');
            roundRect(ctx,14,178,130,12,6,tg);
            ctx.textBaseline='alphabetic';
        },

        /* ── SLIDING PUZZLE ─────────────────────────────────────────── */
        slidingpuzzle: function (ctx) {
            gradBg(ctx,'#1a237e','#4a148c');
            var nums=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15];
            var sz=46, gap=4, ox=12, oy=12;
            nums.forEach(function(v,i){
                var x=ox+(i%4)*(sz+gap), y=oy+Math.floor(i/4)*(sz+gap);
                if(v===0){
                    roundRect(ctx,x,y,sz,sz,6,'rgba(255,255,255,0.08)');
                    return;
                }
                var tg2=ctx.createLinearGradient(x,y,x+sz,y+sz);
                tg2.addColorStop(0,'#5c6bc0'); tg2.addColorStop(1,'#7c4dff');
                roundRect(ctx,x,y,sz,sz,6,tg2);
                ctx.fillStyle='rgba(255,255,255,0.15)';
                ctx.fillRect(x+2,y+2,sz-4,8);
                ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif';
                ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText(v,x+sz/2,y+sz/2);
            });
            // move indicator
            ctx.fillStyle='rgba(255,255,200,0.6)';
            ctx.font='12px sans-serif'; ctx.textBaseline='alphabetic';
            ctx.fillText('↑ mover', ox+3*(sz+gap)+8, oy+3*(sz+gap)+sz+14);
        },

        /* ── FRUIT CATCHER ──────────────────────────────────────────── */
        fruitcatcher: function (ctx) {
            gradBg(ctx,'#0d1b2a','#1a3c5e');
            // stars
            ctx.fillStyle='rgba(255,255,255,0.5)';
            [[20,15],[55,8],[95,20],[140,10],[180,18]].forEach(function(s){ctx.fillRect(s[0],s[1],2,2);});
            // fruits falling
            var fruits=[
                {x:30,y:40,col:'#ff6b6b',col2:'#c0392b',label:'🍎',r:16},
                {x:90,y:20,col:'#ffd93d',col2:'#f39c12',label:'🍋',r:14},
                {x:155,y:55,col:'#a8e063',col2:'#27ae60',label:'🍏',r:15},
                {x:200,y:30,col:'#ff9f43',col2:'#e67e22',label:'🍊',r:14},
                {x:65,y:90,col:'#fd79a8',col2:'#e84393',label:'🍓',r:13},
                {x:130,y:75,col:'#6c5ce7',col2:'#4834d4',label:'🍇',r:12},
            ];
            fruits.forEach(function(f){
                // fruit circle
                var fg=ctx.createRadialGradient(f.x-4,f.y-4,0,f.x,f.y,f.r);
                fg.addColorStop(0,'#fff'); fg.addColorStop(0.2,f.col); fg.addColorStop(1,f.col2);
                ctx.fillStyle=fg;
                ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill();
                // shine
                ctx.fillStyle='rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.ellipse(f.x-4,f.y-4,f.r*0.4,f.r*0.25,-0.3,0,Math.PI*2); ctx.fill();
                // trail
                ctx.strokeStyle=f.col+'88'; ctx.lineWidth=2; ctx.setLineDash([3,4]);
                ctx.beginPath(); ctx.moveTo(f.x,f.y-f.r); ctx.lineTo(f.x,f.y-f.r-18); ctx.stroke();
                ctx.setLineDash([]);
            });
            // bomb
            ctx.fillStyle='#2d3436';
            ctx.beginPath(); ctx.arc(185,110,14,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#fdcb6e'; ctx.fillRect(182,96,6,6);
            ctx.fillStyle='#ff7675'; ctx.beginPath(); ctx.arc(185,96,4,0,Math.PI*2); ctx.fill();
            // basket
            var bx=70, by=175, bw=80, bh=30;
            ctx.fillStyle='#8b6914';
            ctx.beginPath();
            ctx.moveTo(bx,by); ctx.lineTo(bx+bw,by);
            ctx.lineTo(bx+bw-10,by+bh); ctx.lineTo(bx+10,by+bh);
            ctx.closePath(); ctx.fill();
            // basket weave
            ctx.strokeStyle='#6d5010'; ctx.lineWidth=1.5;
            for(var i=0;i<4;i++){
                ctx.beginPath();
                ctx.moveTo(bx+i*22,by); ctx.lineTo(bx+10+i*16,by+bh); ctx.stroke();
            }
            ctx.beginPath(); ctx.moveTo(bx,by+bh*0.5); ctx.lineTo(bx+bw,by+bh*0.5); ctx.stroke();
            // lives
            [10,28,46].forEach(function(hx){
                ctx.fillStyle='#e74c3c';
                ctx.beginPath();
                ctx.moveTo(hx+8,205); ctx.bezierCurveTo(hx+8,200,hx,200,hx,205);
                ctx.bezierCurveTo(hx,212,hx+8,216,hx+8,220);
                ctx.bezierCurveTo(hx+8,216,hx+16,212,hx+16,205);
                ctx.bezierCurveTo(hx+16,200,hx+8,200,hx+8,205);
                ctx.fill();
            });
            // score
            ctx.fillStyle='#fff'; ctx.font='bold 13px monospace'; ctx.textAlign='right';
            ctx.fillText('850 pts', W-8, 22);
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

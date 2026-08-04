// ============================================================
// PACMAN — main.js  (movimiento basado en celda-destino + niveles)
// ============================================================

(function () {
    'use strict';

    // ── Laberintos (3 diseños, rotan por nivel) ──────────────
    var MAZE_TEMPLATES = [
        // Laberinto 1 — clásico
        [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,1,0,0,0,0,0,1],
            [1,0,1,1,0,0,1,1,0,0,1,1,0,1],
            [1,0,1,1,0,0,0,0,0,0,1,1,0,1],
            [1,0,0,0,0,1,1,1,1,0,0,0,0,1],
            [1,1,1,0,0,1,0,0,1,0,0,1,1,1],
            [1,1,1,0,0,1,0,0,1,0,0,1,1,1],
            [1,1,1,0,0,0,0,0,0,0,0,1,1,1],
            [1,1,1,0,0,1,1,1,1,0,0,1,1,1],
            [1,0,0,0,0,1,1,1,1,0,0,0,0,1],
            [1,0,1,1,0,0,0,0,0,0,1,1,0,1],
            [1,0,0,1,0,0,1,1,0,0,1,0,0,1],
            [1,0,0,0,0,0,1,1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        // Laberinto 2 — más abierto
        [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,1,1,1,0,1,1,0,1,1,1,0,1],
            [1,0,1,0,0,0,1,1,0,0,0,1,0,1],
            [1,0,1,0,1,0,0,0,0,1,0,1,0,1],
            [1,0,0,0,1,1,0,0,1,1,0,0,0,1],
            [1,1,1,0,0,0,0,0,0,0,0,1,1,1],
            [1,1,1,0,1,1,0,0,1,1,0,1,1,1],
            [1,0,0,0,1,1,0,0,1,1,0,0,0,1],
            [1,0,1,0,0,0,0,0,0,0,0,1,0,1],
            [1,0,1,0,1,0,0,0,0,1,0,1,0,1],
            [1,0,1,0,0,0,1,1,0,0,0,1,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        // Laberinto 3 — laberíntico
        [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,1,0,0,0,0,0,1,0,0,1],
            [1,0,1,0,1,0,1,1,1,0,1,0,1,1],
            [1,0,1,0,0,0,0,0,0,0,0,0,1,1],
            [1,0,1,1,1,1,0,0,1,1,1,0,0,1],
            [1,0,0,0,0,1,0,0,1,0,0,0,0,1],
            [1,1,1,0,0,0,0,0,0,0,0,1,1,1],
            [1,1,1,0,1,1,0,0,1,1,0,1,1,1],
            [1,0,0,0,0,1,0,0,1,0,0,0,0,1],
            [1,0,1,1,1,1,0,0,1,1,1,0,0,1],
            [1,0,1,0,0,0,0,0,0,0,0,0,1,1],
            [1,0,1,0,1,0,1,1,1,0,1,0,1,1],
            [1,0,0,0,1,0,0,0,0,0,1,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
    ];

    var POWER_CELLS = [
        {row:1,col:1},{row:1,col:12},
        {row:12,col:1},{row:12,col:12}
    ];

    var ROWS = 14, COLS = 14, CELL = 40;
    var CANVAS_W = 560, CANVAS_H = 560;

    var canvas = document.getElementById('pacmanCanvas');
    var ctx    = canvas.getContext('2d');

    // ── UI ───────────────────────────────────────────────────
    var scoreEl      = document.getElementById('score');
    var highScoreEl  = document.getElementById('highScore');
    var levelEl      = document.getElementById('level');
    var livesEl      = document.getElementById('lives');
    var startBtn     = document.getElementById('startBtn');
    var restartBtn   = document.getElementById('restartBtn');
    var playAgainBtn = document.getElementById('playAgainBtn');
    var gameOverPopup= document.getElementById('gameOverPopup');
    var popupTitle   = document.getElementById('popupTitle');
    var finalScoreEl = document.getElementById('finalScore');
    var finalHighEl  = document.getElementById('finalHigh');
    var mobileScoreEl= document.getElementById('mobileScore');

    // ── Estado ───────────────────────────────────────────────
    var maze = [], pellets = [], totalPellets = 0;
    var score = 0, highScore = GameStore.getNum('pacmanHighScore', 0), lives = 3, level = 1;
    var gameState = 'idle';  // idle | playing | dying | levelclear | gameover
    var pulseT = 0, rafId = null, lastTime = 0;
    var scorePopups = [];
    var dyingTimer = 0,     DYING_DURATION    = 90;
    var levelClearTimer = 0, LEVEL_CLEAR_DURATION = 100;
    var powerTimer = 0,     POWER_DURATION    = 300;
    var ghostEatMultiplier = 1;

    // ── Pacman ───────────────────────────────────────────────
    var pac = {
        row:12, col:1,
        targetRow:12, targetCol:1,   // celda a la que nos dirigimos
        x:0, y:0,
        dir:{x:0,y:0},
        nextDir:{x:0,y:0},
        mouthAngle:0, mouthDir:1,
        moving:false,
    };

    // ── Fantasmas ────────────────────────────────────────────
    var GHOST_COLORS = ['#FF0000','#FFB8FF','#00FFFF','#FFB852'];
    var GHOST_NAMES  = ['Blinky','Pinky','Inky','Clyde'];
    var GHOST_STARTS = [
        {row:6,col:6},{row:6,col:7},{row:7,col:6},{row:7,col:7}
    ];
    var ghosts = [];
    var GHOST_DIRS = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

    // ── Helpers ──────────────────────────────────────────────
    function cellCenter(r, c) { return {x: c*CELL+CELL/2, y: r*CELL+CELL/2}; }
    function isWall(r, c) {
        if (r<0||r>=ROWS||c<0||c>=COLS) return true;
        return maze[r][c] === 1;
    }
    function canMove(r, c, d) { return !isWall(r+d.y, c+d.x); }
    function baseSpeed() { return Math.min(2 + (level-1)*0.2, 3.6); }
    function numGhosts() { return level <= 1 ? 2 : level === 2 ? 3 : 4; }

    // ── Construir laberinto ──────────────────────────────────
    function buildMaze() {
        var template = MAZE_TEMPLATES[(level-1) % MAZE_TEMPLATES.length];
        maze = [];
        pellets = [];
        totalPellets = 0;
        for (var r=0; r<ROWS; r++) maze.push(template[r].slice());
        for (var r=0; r<ROWS; r++) {
            for (var c=0; c<COLS; c++) {
                if (maze[r][c]===0) {
                    var isPower = POWER_CELLS.some(function(p){return p.row===r&&p.col===c;});
                    pellets.push({row:r,col:c,power:isPower,eaten:false});
                    totalPellets++;
                }
            }
        }
    }

    function snapPacman() {
        pac.row = 12; pac.col = 1;
        pac.targetRow = 12; pac.targetCol = 1;
        var cc = cellCenter(12,1);
        pac.x = cc.x; pac.y = cc.y;
        pac.dir = {x:0,y:0}; pac.nextDir = {x:0,y:0};
        pac.moving = false; pac.mouthAngle = 0;
    }

    function initGhosts() {
        ghosts = [];
        var n = numGhosts();
        for (var i=0; i<n; i++) {
            var s = GHOST_STARTS[i];
            var cc = cellCenter(s.row, s.col);
            ghosts.push({
                row:s.row, col:s.col,
                targetRow:s.row, targetCol:s.col,
                x:cc.x, y:cc.y,
                dir:{x:GHOST_DIRS[i%4].x, y:GHOST_DIRS[i%4].y},
                speed: baseSpeed() * 0.82,
                color: GHOST_COLORS[i],
                name:  GHOST_NAMES[i],
                vulnerable:false, eaten:false,
            });
        }
    }

    // ────────────────────────────────────────────────────────
    // JUEGO
    // ────────────────────────────────────────────────────────
    function startGame() {
        score=0; lives=3; level=1;
        buildMaze(); snapPacman(); initGhosts();
        powerTimer=0; ghostEatMultiplier=1; scorePopups=[];
        gameState='playing'; updateUI();
        GameAudio.start();
        startLoop();
    }

    function resetRound() {
        snapPacman(); initGhosts();
        powerTimer=0; ghostEatMultiplier=1; scorePopups=[];
        gameState='playing';
    }

    // ── Loop ─────────────────────────────────────────────────
    function startLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
    }
    function loop(ts) {
        var dt = ts - lastTime;
        if (dt < 14) { rafId=requestAnimationFrame(loop); return; }
        lastTime = ts;
        update(); draw();
        rafId = requestAnimationFrame(loop);
    }

    // ── Update ───────────────────────────────────────────────
    function update() {
        if (gameState==='dying') {
            if (--dyingTimer <= 0) {
                if (--lives <= 0) endGame();
                else resetRound();
                updateUI();
            }
            return;
        }
        if (gameState==='levelclear') {
            if (--levelClearTimer <= 0) {
                level++;
                buildMaze(); snapPacman(); initGhosts();
                powerTimer=0; ghostEatMultiplier=1; scorePopups=[];
                gameState='playing'; updateUI();
            }
            return;
        }
        if (gameState!=='playing') return;

        pulseT += 0.08;
        if (powerTimer > 0) {
            if (--powerTimer === 0) {
                ghosts.forEach(function(g){g.vulnerable=false; g.eaten=false;});
                ghostEatMultiplier=1;
            }
        }
        movePacman();
        eatPellets();
        moveGhosts();
        checkGhostCollision();
        tickScorePopups();
    }

    // ── Movimiento Pacman (modelo celda-destino) ─────────────
    function movePacman() {
        var speed = baseSpeed();

        // Sin dirección: intentar arrancar con nextDir
        if (pac.dir.x===0 && pac.dir.y===0) {
            if (pac.nextDir.x!==0 || pac.nextDir.y!==0) {
                if (canMove(pac.row, pac.col, pac.nextDir)) {
                    pac.dir = {x:pac.nextDir.x, y:pac.nextDir.y};
                    pac.nextDir = {x:0,y:0};
                    pac.targetRow = pac.row + pac.dir.y;
                    pac.targetCol = pac.col + pac.dir.x;
                }
            }
            pac.moving = false;
            animateMouth(); return;
        }

        var tcc = cellCenter(pac.targetRow, pac.targetCol);
        var distToTarget = pac.dir.x!==0
            ? Math.abs(tcc.x - pac.x)
            : Math.abs(tcc.y - pac.y);

        if (distToTarget <= speed) {
            // Llega a la celda destino
            var overshoot = speed - distToTarget;
            pac.x = tcc.x; pac.y = tcc.y;
            pac.row = pac.targetRow; pac.col = pac.targetCol;

            // Decidir próxima dirección: nextDir primero, luego actual, luego parar
            var newDir = null;
            if ((pac.nextDir.x!==0||pac.nextDir.y!==0) && canMove(pac.row,pac.col,pac.nextDir)) {
                newDir = {x:pac.nextDir.x, y:pac.nextDir.y};
                pac.nextDir = {x:0,y:0};
            } else if (canMove(pac.row, pac.col, pac.dir)) {
                newDir = pac.dir;
            }

            if (newDir) {
                pac.dir = newDir;
                pac.targetRow = pac.row + pac.dir.y;
                pac.targetCol = pac.col + pac.dir.x;
                pac.x += pac.dir.x * overshoot;
                pac.y += pac.dir.y * overshoot;
            } else {
                pac.dir = {x:0,y:0};
                pac.moving = false;
                animateMouth(); return;
            }
        } else {
            pac.x += pac.dir.x * speed;
            pac.y += pac.dir.y * speed;
        }
        pac.moving = true;
        animateMouth();
    }

    function animateMouth() {
        var max = 0.35;
        if (pac.moving) {
            pac.mouthAngle += 0.06 * pac.mouthDir;
            if (pac.mouthAngle>=max){pac.mouthAngle=max;pac.mouthDir=-1;}
            if (pac.mouthAngle<=0) {pac.mouthAngle=0; pac.mouthDir=1;}
        } else {
            pac.mouthAngle = 0.15;
        }
    }

    // ── Comer puntos ────────────────────────────────────────
    function eatPellets() {
        for (var i=0; i<pellets.length; i++) {
            var p = pellets[i];
            if (p.eaten||p.row!==pac.row||p.col!==pac.col) continue;
            p.eaten = true;
            if (p.power) {
                score += 50;
                addScorePopup(pac.x, pac.y-16, '+50');
                powerTimer = POWER_DURATION;
                ghostEatMultiplier = 1;
                ghosts.forEach(function(g){if(!g.eaten)g.vulnerable=true;});
                GameAudio.scoreHigh();
            } else {
                score += 10;
                GameAudio.score();
            }
            updateUI();
            if (pellets.every(function(pp){return pp.eaten;})) {
                GameAudio.win();
                gameState='levelclear';
                levelClearTimer=LEVEL_CLEAR_DURATION;
            }
        }
    }

    // ── Mover fantasmas (también celda-destino) ──────────────
    function moveGhosts() {
        ghosts.forEach(function(g,idx){
            if (g.eaten) return;
            moveGhost(g, idx);
        });
    }

    function moveGhost(g, idx) {
        var speed = g.speed;
        var tcc = cellCenter(g.targetRow, g.targetCol);
        var dist = g.dir.x!==0
            ? Math.abs(tcc.x - g.x)
            : Math.abs(tcc.y - g.y);

        if (dist <= speed) {
            var overshoot = speed - dist;
            g.x = tcc.x; g.y = tcc.y;
            g.row = g.targetRow; g.col = g.targetCol;

            // Direcciones válidas (sin reversa si hay otra opción)
            var reverse = {x:-g.dir.x, y:-g.dir.y};
            var valid = [], all = [];
            for (var j=0; j<GHOST_DIRS.length; j++) {
                var d = GHOST_DIRS[j];
                if (!isWall(g.row+d.y, g.col+d.x)) {
                    all.push(d);
                    if (!(d.x===reverse.x&&d.y===reverse.y)) valid.push(d);
                }
            }
            var pool = valid.length ? valid : all;

            var chosen;
            if (idx===0 && !g.vulnerable) {
                chosen = chaseDir(g, pool);
            } else if (g.vulnerable) {
                chosen = fleeDir(g, pool);
            } else {
                chosen = pool[Math.floor(Math.random()*pool.length)];
            }
            g.dir = chosen;
            g.targetRow = g.row + g.dir.y;
            g.targetCol = g.col + g.dir.x;
            g.x += g.dir.x * overshoot;
            g.y += g.dir.y * overshoot;
        } else {
            g.x += g.dir.x * speed;
            g.y += g.dir.y * speed;
        }
    }

    function chaseDir(g, pool) {
        var best=null, bestD=Infinity;
        pool.forEach(function(d){
            var dx=(g.col+d.x)-pac.col, dy=(g.row+d.y)-pac.row;
            var dist=dx*dx+dy*dy;
            if(dist<bestD){bestD=dist;best=d;}
        });
        return best||pool[0];
    }
    function fleeDir(g, pool) {
        var best=null, bestD=-Infinity;
        pool.forEach(function(d){
            var dx=(g.col+d.x)-pac.col, dy=(g.row+d.y)-pac.row;
            var dist=dx*dx+dy*dy;
            if(dist>bestD){bestD=dist;best=d;}
        });
        return best||pool[0];
    }

    // ── Colisiones ───────────────────────────────────────────
    function checkGhostCollision() {
        var hitR = CELL * 0.5;
        ghosts.forEach(function(g){
            if (g.eaten) return;
            var dx=g.x-pac.x, dy=g.y-pac.y;
            if (Math.sqrt(dx*dx+dy*dy) < hitR) {
                if (g.vulnerable) {
                    var pts = 200 * ghostEatMultiplier;
                    ghostEatMultiplier = Math.min(ghostEatMultiplier*2, 8);
                    score += pts;
                    addScorePopup(g.x, g.y-16, '+'+pts);
                    g.eaten=true; g.vulnerable=false;
                    GameAudio.scoreHigh(); updateUI();
                    (function(gh){setTimeout(function(){respawnGhost(gh);},3000);})(g);
                } else {
                    if (gameState==='dying') return;
                    gameState='dying'; dyingTimer=DYING_DURATION;
                    GameAudio.gameOver();
                }
            }
        });
    }

    function respawnGhost(g) {
        if (gameState==='gameover') return;
        var idx = ghosts.indexOf(g);
        var s = GHOST_STARTS[idx]||GHOST_STARTS[0];
        var cc = cellCenter(s.row, s.col);
        g.row=s.row; g.col=s.col;
        g.targetRow=s.row; g.targetCol=s.col;
        g.x=cc.x; g.y=cc.y;
        g.eaten=false; g.vulnerable=powerTimer>0;
        g.dir=GHOST_DIRS[Math.floor(Math.random()*4)];
        g.targetRow=g.row+g.dir.y; g.targetCol=g.col+g.dir.x;
    }

    // ── Popups de puntuación ─────────────────────────────────
    function addScorePopup(x,y,text){scorePopups.push({x:x,y:y,text:text,life:50,alpha:1});}
    function tickScorePopups(){
        for(var i=scorePopups.length-1;i>=0;i--){
            var p=scorePopups[i]; p.life--; p.y-=0.5; p.alpha=p.life/50;
            if(p.life<=0)scorePopups.splice(i,1);
        }
    }

    // ── Fin ──────────────────────────────────────────────────
    function endGame() {
        gameState='gameover';
        if (score>highScore) {
            highScore=score;
            GameStore.set('pacmanHighScore', highScore);
        }
        popupTitle.textContent = 'Game Over';
        finalScoreEl.textContent = 'Puntaje: '+score;
        finalHighEl.textContent  = 'Mejor: '+highScore;
        gameOverPopup.style.display='flex';
        restartBtn.disabled=false; updateUI();
    }

    function updateUI() {
        scoreEl.textContent=score; highScoreEl.textContent=highScore;
        levelEl.textContent=level; livesEl.textContent=lives;
        if(mobileScoreEl) mobileScoreEl.textContent='Pts:'+score+'  Niv:'+level+'  Vidas:'+lives;
    }

    // ────────────────────────────────────────────────────────
    // DIBUJO
    // ────────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
        ctx.fillStyle='#000'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        drawMaze(); drawPellets(); drawScorePopups();
        if (gameState==='dying') drawDying();
        else drawPacman();
        drawGhosts(); drawLives();
        if (gameState==='levelclear') drawLevelClear();
        if (gameState==='idle') drawIdleOverlay();
    }

    function drawMaze() {
        for (var r=0;r<ROWS;r++) {
            for (var c=0;c<COLS;c++) {
                if (maze[r][c]===1) {
                    var x=c*CELL, y=r*CELL;
                    ctx.fillStyle='#1a2980'; ctx.fillRect(x,y,CELL,CELL);
                    ctx.fillStyle='#2e4cb3'; ctx.fillRect(x+2,y+2,CELL-4,CELL-4);
                    ctx.fillStyle='#3a5fd9';
                    ctx.fillRect(x+2,y+2,CELL-4,3);
                    ctx.fillRect(x+2,y+2,3,CELL-4);
                }
            }
        }
    }

    function drawPellets() {
        for (var i=0;i<pellets.length;i++) {
            var p=pellets[i]; if(p.eaten) continue;
            var cc=cellCenter(p.row,p.col);
            if (p.power) {
                var pulse=6+Math.sin(pulseT)*2;
                ctx.beginPath(); ctx.arc(cc.x,cc.y,pulse,0,Math.PI*2);
                ctx.fillStyle='#FFE000'; ctx.fill();
                ctx.beginPath(); ctx.arc(cc.x,cc.y,pulse+3,0,Math.PI*2);
                ctx.strokeStyle='rgba(255,220,0,0.3)'; ctx.lineWidth=2; ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(cc.x,cc.y,3,0,Math.PI*2);
                ctx.fillStyle='#e8d5a3'; ctx.fill();
            }
        }
    }

    function drawPacman() {
        if (gameState!=='playing'&&gameState!=='levelclear') return;
        var x=pac.x, y=pac.y, r=CELL*0.42;
        var angle=0;
        if(pac.dir.x===1)  angle=0;
        if(pac.dir.x===-1) angle=Math.PI;
        if(pac.dir.y===-1) angle=-Math.PI/2;
        if(pac.dir.y===1)  angle=Math.PI/2;
        var mouth=pac.mouthAngle*Math.PI;
        var grad=ctx.createRadialGradient(x-r*0.2,y-r*0.2,r*0.05,x,y,r);
        grad.addColorStop(0,'#FFEB3B'); grad.addColorStop(1,'#F57F17');
        ctx.beginPath(); ctx.moveTo(x,y);
        ctx.arc(x,y,r,angle+mouth,angle+Math.PI*2-mouth);
        ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
        var ex=x+Math.cos(angle-Math.PI/4)*r*0.5;
        var ey=y+Math.sin(angle-Math.PI/4)*r*0.5;
        ctx.beginPath(); ctx.arc(ex,ey,2.5,0,Math.PI*2);
        ctx.fillStyle='#1a2980'; ctx.fill();
    }

    function drawDying() {
        var progress=1-dyingTimer/DYING_DURATION;
        var x=pac.x, y=pac.y, r=CELL*0.42;
        var halfAngle=Math.PI*(1-progress);
        if(halfAngle<=0.01) return;
        var grad=ctx.createRadialGradient(x,y,0,x,y,r);
        grad.addColorStop(0,'#FFEB3B'); grad.addColorStop(1,'#F57F17');
        ctx.beginPath(); ctx.moveTo(x,y);
        ctx.arc(x,y,r,-halfAngle,halfAngle);
        ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    }

    function drawGhosts() { ghosts.forEach(drawGhost); }

    function drawGhost(g) {
        if(g.eaten) return;
        var x=g.x, y=g.y, w=CELL*0.8, h=CELL*0.85, hw=w/2;
        var left=x-hw, top=y-h/2;
        var flashing=powerTimer>0&&powerTimer<80&&Math.floor(powerTimer/10)%2===0;
        var color = g.vulnerable ? (flashing?'#fff':'#1a237e') : g.color;
        ctx.beginPath();
        ctx.arc(x,top+hw,hw,Math.PI,0);
        ctx.lineTo(left+w,top+h-CELL*0.12);
        var bw=w/3;
        ctx.arc(left+w-bw*0.5,top+h-CELL*0.12,bw*0.5,0,Math.PI);
        ctx.arc(left+w-bw*1.5,top+h-CELL*0.12,bw*0.5,0,Math.PI);
        ctx.arc(left+w-bw*2.5,top+h-CELL*0.12,bw*0.5,0,Math.PI);
        ctx.closePath(); ctx.fillStyle=color; ctx.fill();
        var eyeY=top+hw*0.85;
        [-hw*0.38, hw*0.38].forEach(function(ox){
            var ex=x+ox;
            ctx.beginPath(); ctx.ellipse(ex,eyeY,hw*0.28,hw*0.35,0,0,Math.PI*2);
            ctx.fillStyle=g.vulnerable?'rgba(180,180,255,0.7)':'#fff'; ctx.fill();
            if(!g.vulnerable){
                var px2=ex+g.dir.x*hw*0.1, py2=eyeY+g.dir.y*hw*0.1;
                ctx.beginPath(); ctx.arc(px2,py2,hw*0.14,0,Math.PI*2);
                ctx.fillStyle='#1a6abf'; ctx.fill();
            } else {
                ctx.strokeStyle=flashing?'#f00':'rgba(100,100,200,0.8)'; ctx.lineWidth=1.5;
                var xs=hw*0.12;
                ctx.beginPath();
                ctx.moveTo(ex-xs,eyeY-xs); ctx.lineTo(ex+xs,eyeY+xs);
                ctx.moveTo(ex+xs,eyeY-xs); ctx.lineTo(ex-xs,eyeY+xs);
                ctx.stroke();
            }
        });
    }

    function drawLives() {
        var iconR=8, startX=10+iconR, baseY=CANVAS_H-CELL/2;
        ctx.fillStyle='#FFE000';
        for(var i=0;i<lives;i++){
            var lx=startX+i*(iconR*2+6);
            ctx.beginPath(); ctx.moveTo(lx,baseY);
            ctx.arc(lx,baseY,iconR,0.25,Math.PI*2-0.25);
            ctx.closePath(); ctx.fill();
        }
    }

    function drawScorePopups() {
        scorePopups.forEach(function(p){
            ctx.globalAlpha=p.alpha;
            ctx.fillStyle='#FFE000'; ctx.font='bold 14px monospace';
            ctx.textAlign='center'; ctx.fillText(p.text,p.x,p.y);
            ctx.globalAlpha=1;
        });
    }

    function drawLevelClear() {
        var alpha=Math.min(1,levelClearTimer/20);
        ctx.fillStyle='rgba(0,0,0,'+(alpha*0.55)+')';
        ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        ctx.globalAlpha=alpha;
        ctx.fillStyle='#FFE000'; ctx.font='bold 36px monospace'; ctx.textAlign='center';
        ctx.fillText('¡Nivel '+(level+1)+'!', CANVAS_W/2, CANVAS_H/2);
        ctx.fillStyle='#8fd3f4'; ctx.font='18px monospace';
        ctx.fillText('Nuevo laberinto...', CANVAS_W/2, CANVAS_H/2+44);
        ctx.globalAlpha=1;
    }

    function drawIdleOverlay() {
        ctx.fillStyle='rgba(0,0,0,0.72)';
        ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
        ctx.fillStyle='#FFE000'; ctx.font='bold 38px monospace'; ctx.textAlign='center';
        ctx.fillText('PACMAN',CANVAS_W/2,CANVAS_H/2-28);
        ctx.fillStyle='#8fd3f4'; ctx.font='18px monospace';
        ctx.fillText('Presiona Iniciar',CANVAS_W/2,CANVAS_H/2+18);
        ctx.fillStyle='rgba(255,220,0,0.5)'; ctx.font='12px monospace';
        ctx.fillText('3 laberintos · hasta 4 fantasmas',CANVAS_W/2,CANVAS_H/2+48);
    }

    // ────────────────────────────────────────────────────────
    // INPUT
    // ────────────────────────────────────────────────────────
    var DIR_MAP = {
        ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0},
        ArrowUp:{x:0,y:-1},   ArrowDown:{x:0,y:1},
        a:{x:-1,y:0}, d:{x:1,y:0}, w:{x:0,y:-1}, s:{x:0,y:1},
        A:{x:-1,y:0}, D:{x:1,y:0}, W:{x:0,y:-1}, S:{x:0,y:1},
    };

    document.addEventListener('keydown', function(e){
        var d=DIR_MAP[e.key];
        if(d){
            e.preventDefault();
            if(gameState==='playing'){
                pac.nextDir={x:d.x,y:d.y};
                if(pac.dir.x===0&&pac.dir.y===0&&canMove(pac.row,pac.col,d)){
                    pac.dir={x:d.x,y:d.y};
                    pac.targetRow=pac.row+d.y; pac.targetCol=pac.col+d.x;
                }
            }
        }
    });

    var touchX=0, touchY=0;
    canvas.addEventListener('touchstart',function(e){
        if(e.touches.length){touchX=e.touches[0].clientX; touchY=e.touches[0].clientY;}
    },{passive:true});
    canvas.addEventListener('touchend',function(e){
        if(!e.changedTouches.length) return;
        var dx=e.changedTouches[0].clientX-touchX;
        var dy=e.changedTouches[0].clientY-touchY;
        if(Math.abs(dx)<10&&Math.abs(dy)<10) return;
        var d = Math.abs(dx)>Math.abs(dy)
            ? (dx>0?{x:1,y:0}:{x:-1,y:0})
            : (dy>0?{x:0,y:1}:{x:0,y:-1});
        if(gameState==='playing'){
            pac.nextDir=d;
            if(pac.dir.x===0&&pac.dir.y===0&&canMove(pac.row,pac.col,d)){
                pac.dir=d; pac.targetRow=pac.row+d.y; pac.targetCol=pac.col+d.x;
            }
        }
    },{passive:true});

    // ── Botones ──────────────────────────────────────────────
    function doStart(){
        gameOverPopup.style.display='none';
        startGame();
        startBtn.disabled=true; restartBtn.disabled=false;
        GameAudio.click();
    }
    startBtn.addEventListener('click', doStart);
    restartBtn.addEventListener('click', function(){ if(!restartBtn.disabled){doStart();} });
    playAgainBtn.addEventListener('click', doStart);

    // ── Inicio en idle ───────────────────────────────────────
    (function(){
        buildMaze(); snapPacman();
        gameState='idle'; updateUI(); draw();
    })();

})();

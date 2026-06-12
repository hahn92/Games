// Torres de Hanói — Canvas, niveles 3..8 discos
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('hanoiCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 420
var H = canvas.height;  // 360

var MIN_DISKS = 3, MAX_DISKS = 8;

/* ── Geometría de torres ── */
var BASE_Y   = H - 36;       // y de la base/suelo
var PEG_TOP  = 70;           // y de la cima de los postes
var PEG_W    = 10;
var DISK_H   = 22;
var TOWER_X  = [W * 0.2, W * 0.5, W * 0.8];

/* ── Colores de disco (gradiente por índice de tamaño) ── */
var DISK_COLORS = [
    ['#8fd3f4', '#3a7bd5'], // 1 (más pequeño)
    ['#43e97b', '#13a05c'],
    ['#fddb92', '#d8a015'],
    ['#ff9a9e', '#d6336c'],
    ['#a18cd1', '#6a3fb5'],
    ['#ff512f', '#b5170a'],
    ['#00f2fe', '#0077b6'],
    ['#f7b733', '#c75c00']
];

/* ── Estado ── */
var gs = {
    n: 3,                // número de discos
    pegs: [[], [], []],  // cada peg: array de tamaños (abajo->arriba), tamaño 1=pequeño..n=grande
    selected: -1,        // peg origen seleccionado o -1
    moves: 0,
    status: 'playing',   // playing | won
    anim: null,          // {size, fromPeg, toPeg, x, y, tx, ty, phase}
    shake: 0,            // frames de shake
    particles: []        // partículas de victoria
};

/* ── Stats persistentes (mejor marca por nivel) ── */
var mobileScoreEl = document.getElementById('mobileScore');
var best = JSON.parse(localStorage.getItem('hanoiBest') || '{}');
function saveBest() { localStorage.setItem('hanoiBest', JSON.stringify(best)); }
function optimalMoves(n) { return Math.pow(2, n) - 1; }

function updateMobileScore() {
    if (!mobileScoreEl) return;
    var opt = optimalMoves(gs.n);
    var b = best[gs.n] ? (' · Mejor:' + best[gs.n]) : '';
    var st = gs.status === 'won' ? '¡Resuelto!' : (gs.selected >= 0 ? 'Elige destino' : 'Discos:' + gs.n);
    mobileScoreEl.textContent = st + ' · Mov:' + gs.moves + '/' + opt + b;
}

function updateLabels() {
    var lvl = document.getElementById('lvlLabel');
    var mv  = document.getElementById('movesLabel');
    if (lvl) lvl.textContent = 'Discos: ' + gs.n;
    if (mv) mv.textContent = 'Movimientos: ' + gs.moves + ' / ' + optimalMoves(gs.n);
    updateMobileScore();
}

/* ── Setup ── */
function setupLevel(n) {
    gs.n = Math.max(MIN_DISKS, Math.min(MAX_DISKS, n));
    gs.pegs = [[], [], []];
    for (var s = gs.n; s >= 1; s--) gs.pegs[0].push(s); // abajo grande, arriba pequeño
    gs.selected = -1;
    gs.moves = 0;
    gs.status = 'playing';
    gs.anim = null;
    gs.shake = 0;
    gs.particles = [];
    closePopup();
    updateLabels();
    GameAudio.start();
}

/* ── Dimensiones de disco ── */
function diskWidth(size) {
    var maxW = 118;
    var minW = 38;
    return minW + (maxW - minW) * (size - 1) / Math.max(1, gs.n - 1);
}

// posición y (centro) de un disco en la posición idx (0=fondo) de un peg
function diskY(idxInPeg) {
    return BASE_Y - DISK_H / 2 - idxInPeg * DISK_H;
}

/* ── Interacción ── */
function tryPick(peg) {
    if (gs.pegs[peg].length === 0) { GameAudio.noMatch(); triggerShake(); return; }
    gs.selected = peg;
    GameAudio.click();
    updateMobileScore();
}

function tryDrop(peg) {
    var from = gs.selected;
    var movingSize = gs.pegs[from][gs.pegs[from].length - 1];
    var destTop = gs.pegs[peg].length ? gs.pegs[peg][gs.pegs[peg].length - 1] : Infinity;
    if (movingSize > destTop) {
        // ilegal: disco grande sobre pequeño
        GameAudio.noMatch();
        triggerShake();
        gs.selected = -1;
        updateMobileScore();
        return;
    }
    // iniciar animación de movimiento
    gs.pegs[from].pop();
    var startIdx = gs.pegs[from].length; // ya fue removido
    var sx = TOWER_X[from];
    var sy = diskY(startIdx);
    var endIdx = gs.pegs[peg].length;
    var ex = TOWER_X[peg];
    var ey = diskY(endIdx);
    gs.anim = {
        size: movingSize, fromPeg: from, toPeg: peg,
        x: sx, y: sy, sx: sx, sy: sy, ex: ex, ey: ey,
        liftY: PEG_TOP - DISK_H, t: 0
    };
    gs.selected = -1;
    GameAudio.slide();
}

function handlePeg(peg) {
    if (gs.status !== 'playing' || gs.anim) return;
    if (gs.selected < 0) {
        tryPick(peg);
    } else if (gs.selected === peg) {
        gs.selected = -1; // deseleccionar
        updateMobileScore();
    } else {
        tryDrop(peg);
    }
}

function triggerShake() { gs.shake = 10; }

function finishAnim() {
    var a = gs.anim;
    gs.pegs[a.toPeg].push(a.size);
    gs.anim = null;
    gs.moves++;
    GameAudio.place();
    updateLabels();
    // ¿victoria? todos en peg 2
    if (gs.pegs[2].length === gs.n) {
        gs.status = 'won';
        var opt = optimalMoves(gs.n);
        if (!best[gs.n] || gs.moves < best[gs.n]) { best[gs.n] = gs.moves; saveBest(); }
        spawnWinParticles();
        GameAudio.win();
        setTimeout(showWinPopup, 600);
    }
}

/* ── Partículas de victoria ── */
function spawnWinParticles() {
    gs.particles = [];
    for (var i = 0; i < 60; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = 1.5 + Math.random() * 4;
        gs.particles.push({
            x: TOWER_X[2], y: PEG_TOP + 20,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 2,
            life: 1,
            size: 2 + Math.random() * 3,
            color: DISK_COLORS[Math.floor(Math.random() * DISK_COLORS.length)][0]
        });
    }
}

/* ── Dibujo ── */
function drawDisk(cx, cy, size) {
    var w = diskWidth(size);
    var x = cx - w / 2;
    var y = cy - DISK_H / 2;
    var r = DISK_H / 2;
    var pal = DISK_COLORS[(size - 1) % DISK_COLORS.length];
    var grad = ctx.createLinearGradient(x, y, x, y + DISK_H);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(1, pal[1]);
    ctx.fillStyle = grad;
    roundRect(x, y, w, DISK_H, r);
    ctx.fill();
    // brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(x + 4, y + 3, w - 8, DISK_H * 0.32, DISK_H * 0.16);
    ctx.fill();
    // borde
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(x, y, w, DISK_H, r);
    ctx.stroke();
}

function roundRect(x, y, w, h, r) {
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    var ox = 0, oy = 0;
    if (gs.shake > 0) {
        // Deterministic jitter from the shake counter (no Math.random in render)
        ox = Math.sin(gs.shake * 12.9898) * gs.shake * 0.5;
        oy = Math.cos(gs.shake * 78.233) * gs.shake * 0.5;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // suelo / base
    ctx.fillStyle = '#2a3550';
    roundRect(W * 0.08, BASE_Y, W * 0.84, 16, 6);
    ctx.fill();

    // postes
    for (var p = 0; p < 3; p++) {
        var x = TOWER_X[p];
        // resaltar peg seleccionado u objetivo
        var highlight = (gs.selected === p);
        ctx.fillStyle = highlight ? '#ff7a52' : '#4a5878';
        roundRect(x - PEG_W / 2, PEG_TOP, PEG_W, BASE_Y - PEG_TOP, 4);
        ctx.fill();
        // base del poste
        ctx.fillStyle = '#3a4566';
        ctx.beginPath();
        ctx.arc(x, PEG_TOP, PEG_W * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }

    // discos en pegs
    for (var pp = 0; pp < 3; pp++) {
        var peg = gs.pegs[pp];
        for (var i = 0; i < peg.length; i++) {
            // si es la cima del peg seleccionado, dibujarla más arriba (levantada)
            var isLiftedTop = (gs.selected === pp && i === peg.length - 1 && !gs.anim);
            var cy = isLiftedTop ? (PEG_TOP - DISK_H) : diskY(i);
            drawDisk(TOWER_X[pp], cy, peg[i]);
        }
    }

    // disco en animación
    if (gs.anim) {
        drawDisk(gs.anim.x, gs.anim.y, gs.anim.size);
    }

    // partículas de victoria
    if (gs.particles.length > 0) {
        for (var k = 0; k < gs.particles.length; k++) {
            var pt = gs.particles[k];
            if (pt.life <= 0) continue;
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;
    }

    // etiquetas A B C
    ctx.fillStyle = '#7a88a8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var names = ['A', 'B', 'C'];
    for (var t = 0; t < 3; t++) ctx.fillText(names[t], TOWER_X[t], BASE_Y + 26);

    ctx.restore();

    // HUD superior (movimientos / óptimo)
    ctx.fillStyle = '#cfd8e6';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var opt = optimalMoves(gs.n);
    ctx.fillText('Movimientos: ' + gs.moves + ' / ' + opt, W / 2, 12);

    // estrellas de progreso
    drawStarsPreview();
}

function starsForMoves(moves, n) {
    var opt = optimalMoves(n);
    if (moves <= opt) return 3;
    if (moves <= Math.ceil(opt * 1.5)) return 2;
    return 1;
}

function drawStarsPreview() {
    var stars = gs.status === 'won' ? starsForMoves(gs.moves, gs.n) : 0;
    var startX = W / 2 - 30;
    var y = 42;
    for (var i = 0; i < 3; i++) {
        var filled = i < stars;
        drawStar(startX + i * 30, y, 9, filled ? '#fddb92' : 'rgba(255,255,255,0.18)');
    }
}

function drawStar(cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        var ix = cx + Math.cos(a) * r;
        var iy = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(ix, iy); else ctx.lineTo(ix, iy);
        var a2 = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
}

/* ── Loop ── */
var lastRenderTs = 0;
var lastTime = 0;
function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastRenderTs < 15) return;
    var dt = lastTime ? (ts - lastTime) / 1000 : 0;
    lastTime = ts;
    lastRenderTs = ts;

    if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - 1);

    // animación de movimiento de disco (subir, mover, bajar)
    if (gs.anim) {
        var a = gs.anim;
        a.t += dt * 2.2;
        var tt = Math.min(1, a.t);
        if (tt < 0.33) {
            // subir
            var u = tt / 0.33;
            a.x = a.sx;
            a.y = a.sy + (a.liftY - a.sy) * u;
        } else if (tt < 0.66) {
            // mover horizontal
            var u2 = (tt - 0.33) / 0.33;
            a.x = a.sx + (a.ex - a.sx) * u2;
            a.y = a.liftY;
        } else {
            // bajar
            var u3 = (tt - 0.66) / 0.34;
            a.x = a.ex;
            a.y = a.liftY + (a.ey - a.liftY) * u3;
        }
        if (a.t >= 1) finishAnim();
    }

    // partículas
    if (gs.particles.length > 0) {
        var alive = false;
        for (var i = 0; i < gs.particles.length; i++) {
            var pt = gs.particles[i];
            pt.vy += 0.12;
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= dt * 0.7;
            if (pt.life > 0) alive = true;
        }
        if (!alive) gs.particles = [];
    }

    draw();
}

/* ── Entrada ── */
function pegFromX(px) {
    // determinar peg más cercano por tercios
    if (px < W / 3) return 0;
    if (px < 2 * W / 3) return 1;
    return 2;
}
function canvasPeg(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width;
    var px = (clientX - rect.left) * sx;
    return pegFromX(px);
}

canvas.addEventListener('click', function (e) {
    handlePeg(canvasPeg(e.clientX, e.clientY));
});
canvas.addEventListener('touchstart', function (e) {
    if (!e.touches.length) return;
    e.preventDefault();
    var t = e.touches[0];
    handlePeg(canvasPeg(t.clientX, t.clientY));
}, { passive: false });

/* ── Botones ── */
function changeLevel(delta) {
    GameAudio.click();
    var n = gs.n + delta;
    if (n < MIN_DISKS || n > MAX_DISKS) return;
    setupLevel(n);
}

var restartBtns = document.querySelectorAll('.btn-restart');
for (var i = 0; i < restartBtns.length; i++) restartBtns[i].addEventListener('click', function () {
    GameAudio.click(); setupLevel(gs.n);
});
var lessBtns = document.querySelectorAll('.btn-less');
for (var j = 0; j < lessBtns.length; j++) lessBtns[j].addEventListener('click', function () { changeLevel(-1); });
var moreBtns = document.querySelectorAll('.btn-more');
for (var k = 0; k < moreBtns.length; k++) moreBtns[k].addEventListener('click', function () { changeLevel(1); });

/* ── Popup victoria ── */
function showWinPopup() {
    var stars = starsForMoves(gs.moves, gs.n);
    var opt = optimalMoves(gs.n);
    var pop = document.createElement('div');
    pop.className = 'popup';
    pop.id = 'hanoiPopup';
    var content = document.createElement('div');
    content.className = 'popup-content';
    var h = document.createElement('h2');
    h.textContent = stars === 3 ? '¡Perfecto!' : '¡Resuelto!';
    var starLine = document.createElement('p');
    starLine.style.fontSize = '2rem';
    starLine.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    starLine.style.color = '#fddb92';
    var p = document.createElement('p');
    p.textContent = gs.moves + ' movimientos (mínimo ' + opt + ')';
    var bestLine = document.createElement('p');
    bestLine.style.fontSize = '1rem';
    bestLine.style.color = '#888';
    bestLine.textContent = 'Mejor marca (' + gs.n + ' discos): ' + best[gs.n] + ' mov.';

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin-top:0.5rem;';
    var againBtn = mkBtn('Reintentar', function () { GameAudio.click(); setupLevel(gs.n); });
    btnRow.appendChild(againBtn);
    if (gs.n < MAX_DISKS) {
        var nextBtn = mkBtn('Siguiente nivel', function () { GameAudio.click(); setupLevel(gs.n + 1); });
        btnRow.appendChild(nextBtn);
    }

    content.appendChild(h);
    content.appendChild(starLine);
    content.appendChild(p);
    content.appendChild(bestLine);
    content.appendChild(btnRow);
    pop.appendChild(content);
    document.body.appendChild(pop);
}
function mkBtn(text, fn) {
    var b = document.createElement('button');
    b.style.cssText = 'background:var(--grad-primary);color:#222;border:none;border-radius:8px;padding:0.8rem 1.5rem;font-size:1rem;font-weight:bold;cursor:pointer;';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
}
function closePopup() {
    var p = document.getElementById('hanoiPopup');
    if (p) p.remove();
}

/* ── Arranque ── */
setupLevel(3);
requestAnimationFrame(loop);

})();

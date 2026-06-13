// Frogger
var canvas = document.getElementById('froggerCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 480

var COLS = 10, ROWS = 12;
var CELL = W / COLS; // 40

var score, highScore, lives, isPlaying, animFrameId;
highScore = parseInt(localStorage.getItem('froggerHigh') || '0', 10);

// Frog
var frog = { col: 5, row: 11 };

// Death animation state
var deathAnim = null; // { x, y, particles[], timer, done }

// Lane definitions (row 0 = top = goal)
var LANE_TYPES = [
    'goal',   // 0
    'river',  // 1
    'river',  // 2
    'river',  // 3
    'river',  // 4
    'safe',   // 5 - median
    'road',   // 6
    'road',   // 7
    'road',   // 8
    'road',   // 9
    'road',   // 10
    'safe',   // 11 - start
];

var GOAL_SLOTS = [1, 3, 5, 7, 9];
var filledGoals = [];

var lanes;

function initLanes() {
    lanes = [
        null, // row 0 goal
        { dir: 1,  speed: 1.2, objects: makeObjects(1, 3, 60, 100) },  // troncos medianos
        { dir: -1, speed: 1.5, objects: makeTurtles(2, 3, 2) },        // grupos de 2 tortugas
        { dir: 1,  speed: 1.0, objects: makeObjects(3, 2, 90, 150) },  // troncos largos
        { dir: -1, speed: 1.8, objects: makeTurtles(4, 3, 3) },        // grupos de 3 tortugas
        null, // row 5 median
        { dir: -1, speed: 2.2, objects: makeCars(6, 3, '#ef5350') },
        { dir: 1,  speed: 1.8, objects: makeCars(7, 4, '#ff9800') },
        { dir: -1, speed: 2.5, objects: makeCars(8, 3, '#ce93d8') },
        { dir: 1,  speed: 1.5, objects: makeCars(9, 3, '#80cbc4') },
        { dir: -1, speed: 3.0, objects: makeCars(10, 4, '#fff176') },
        null, // row 11 start
    ];
}

function makeObjects(row, count, gap, w) {
    var objs = [];
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * (W / count + gap), w: w, h: CELL - 8, bob: 0 });
    }
    return objs;
}

// Grupos de tortugas que se sumergen periódicamente (ciclo con fase propia)
function makeTurtles(row, count, perGroup) {
    var objs = [];
    var w = perGroup * 30;
    for (var i = 0; i < count; i++) {
        objs.push({
            x: i * (W / count + 40), w: w, h: CELL - 8, bob: 0,
            turtle: true, n: perGroup,
            cycle: 420, phase: Math.floor(Math.random() * 420)
        });
    }
    return objs;
}

// Estado del ciclo de inmersión: up → warn (parpadeo) → down (sumergida)
function turtleState(o) {
    var t = (frame + o.phase) % o.cycle;
    if (t >= o.cycle - 80)  return 'down';
    if (t >= o.cycle - 140) return 'warn';
    return 'up';
}

function makeCars(row, count, color) {
    var objs = [];
    var spacing = W / count;
    for (var i = 0; i < count; i++) {
        objs.push({ x: i * spacing, w: CELL * 1.4, h: CELL - 8, color: color });
    }
    return objs;
}

function updateLanes() {
    for (var r = 1; r <= 10; r++) {
        if (!lanes[r]) continue;
        var lane = lanes[r];
        var objs = lane.objects;
        for (var i = 0; i < objs.length; i++) {
            objs[i].x += lane.speed * lane.dir;
            if (lane.dir > 0 && objs[i].x > W) objs[i].x = -objs[i].w;
            if (lane.dir < 0 && objs[i].x + objs[i].w < 0) objs[i].x = W;
            // Balanceo del agua (compartido con la rana cuando va montada)
            if (r <= 4) {
                objs[i].bob = Math.sin(frame * 0.04 + i * 1.7 + r * 2.3) * (objs[i].turtle ? 1.2 : 2.5);
                // Burbujas mientras la tortuga está sumergida
                if (objs[i].turtle && turtleState(objs[i]) === 'down' && frame % 12 === 0) {
                    jumpParticles.push({
                        x: objs[i].x + Math.random() * objs[i].w,
                        y: r * CELL + CELL * 0.5 + Math.random() * 8,
                        vx: 0, vy: -0.5 - Math.random() * 0.4,
                        r: 1.5 + Math.random() * 2,
                        life: 14 + Math.random() * 8 | 0, maxLife: 22,
                        color: '#bbdefb'
                    });
                }
            }
            // Exhaust puff spawn for fast cars (rows 6-10)
            if (r >= 6 && Math.abs(lane.speed) > 2.0 && frame % 4 === 0) {
                var o = objs[i];
                var oy = r * CELL + 4;
                var exX = lane.dir > 0 ? o.x : o.x + o.w;
                exhaustParticles.push({
                    x: exX + (Math.random() - 0.5) * 4,
                    y: oy + o.h / 2 + (Math.random() - 0.5) * o.h * 0.5,
                    vx: -lane.dir * (0.3 + Math.random() * 0.4),
                    vy: (Math.random() - 0.5) * 0.3,
                    r: 2 + Math.random() * 2,
                    life: 12 + Math.random() * 8 | 0,
                    maxLife: 20
                });
            }
        }
    }
}

var frogPx = { x: 0, y: 0 };
var frogRidingOffset = 0;
var exhaustParticles = []; // smoke from cars
var jumpParticles   = [];  // dust/splash on frog jump
var landSquash      = 0;   // frames of squash after landing (0-8)

function getFrogPixel() {
    return {
        x: (frog.col - 0.5) * CELL,
        y: frog.row * CELL + 4
    };
}

function drawBackground() {
    // Goal row
    ctx.fillStyle = '#1a237e';
    ctx.fillRect(0, 0, W, CELL);

    // Lily pad slots (with bounce animation)
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gs = GOAL_SLOTS[i];
        var gx = (gs - 1) * CELL;
        // Bounce offset: sinusoidal up/down 2px
        var bounceY = Math.sin(frame * 0.05 + i * 1.2) * 2;
        var isFilled = filledGoals.indexOf(gs) >= 0;

        // Lily pad shadow
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(gx + CELL/2 + 2, CELL/2 + bounceY + 3, CELL/2 - 5, CELL/2 - 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Lily pad body
        ctx.save();
        ctx.translate(0, bounceY);
        var padGrad = ctx.createRadialGradient(gx + CELL/2 - 3, CELL/2 - 4, 1, gx + CELL/2, CELL/2, CELL/2 - 3);
        padGrad.addColorStop(0, isFilled ? '#66bb6a' : '#1a5276');
        padGrad.addColorStop(1, isFilled ? '#2e7d32' : '#0d3b6e');

        ctx.fillStyle = padGrad;
        ctx.beginPath();
        ctx.ellipse(gx + CELL/2, CELL/2, CELL/2 - 4, CELL/2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pad outline
        ctx.strokeStyle = isFilled ? '#a5d6a7' : '#1565c0';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Notch on lily pad
        ctx.strokeStyle = isFilled ? '#388e3c' : '#0d47a1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx + CELL/2, CELL/2);
        ctx.lineTo(gx + CELL/2, CELL/2 - (CELL/2 - 4));
        ctx.stroke();

        if (isFilled) {
            // Draw a small frog in the goal
            drawFrogShape(gx + CELL/2, CELL/2, CELL * 0.35, false);
        } else {
            // Small flower on empty lily pad
            var flCx = gx + CELL/2;
            var flCy = CELL/2;
            var petalR = 3.2;
            ctx.fillStyle = 'rgba(255,255,255,0.72)';
            for (var p = 0; p < 5; p++) {
                var pa = (p / 5) * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.ellipse(flCx + Math.cos(pa) * petalR, flCy + Math.sin(pa) * petalR, 2.4, 1.8, pa, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#ffd54f';
            ctx.beginPath();
            ctx.arc(flCx, flCy, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f9a825';
            ctx.beginPath();
            ctx.arc(flCx, flCy, 1.0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // River rows 1-4 with animated water ripples
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(0, CELL, W, CELL * 4);

    // Water ripples — sinusoidal lines at low opacity
    ctx.save();
    ctx.strokeStyle = 'rgba(100,180,255,0.18)';
    ctx.lineWidth = 1.5;
    for (var r = 1; r <= 4; r++) {
        var baseY = r * CELL + CELL * 0.4;
        var waveOffset = (frame * 0.8) % (W / 2);
        for (var wave = 0; wave < 3; wave++) {
            ctx.beginPath();
            var yOff = wave * (CELL * 0.25);
            for (var wx = 0; wx <= W; wx += 4) {
                var wy = baseY + yOff + Math.sin((wx + waveOffset * (wave + 1)) * 0.06) * 2.5;
                if (wx === 0) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            }
            ctx.stroke();
        }
    }
    ctx.restore();

    // Caustic light columns (animated vertical shimmer bands)
    ctx.save();
    for (var cCol = 0; cCol < 12; cCol++) {
        var cBase = (cCol * 34 + frame * 0.4) % W;
        var cAlpha = 0.06 + 0.04 * Math.sin(frame * 0.03 + cCol);
        var causticG = ctx.createLinearGradient(cBase, CELL, cBase, CELL * 5);
        causticG.addColorStop(0, 'rgba(140,200,255,' + cAlpha + ')');
        causticG.addColorStop(0.5, 'rgba(160,220,255,' + (cAlpha * 1.6) + ')');
        causticG.addColorStop(1, 'rgba(100,170,220,' + (cAlpha * 0.5) + ')');
        ctx.fillStyle = causticG;
        var bandW = 6 + 4 * Math.sin(frame * 0.02 + cCol * 0.8);
        ctx.fillRect(cBase, CELL, bandW, CELL * 4);
    }
    ctx.restore();

    // Median row 5 (safety strip with patterned curb)
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, CELL * 5, W, CELL);
    // Curb stripes on top/bottom edges
    var curbW = 10;
    for (var cb = 0; cb < W; cb += curbW * 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(cb, CELL * 5, curbW, 4);
        ctx.fillRect(cb, CELL * 6 - 4, curbW, 4);
    }
    // Grass blade detail
    ctx.save();
    ctx.strokeStyle = 'rgba(56,130,40,0.5)';
    ctx.lineWidth = 1;
    for (var gLine = 3; gLine < W; gLine += 7) {
        ctx.beginPath();
        ctx.moveTo(gLine, CELL * 6 - 4);
        ctx.lineTo(gLine - 2, CELL * 5 + CELL * 0.5);
        ctx.stroke();
    }
    ctx.restore();

    // Road rows 6-10
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, CELL * 6, W, CELL * 5);
    // Road edge lines (yellow solid)
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, CELL * 6 + 1); ctx.lineTo(W, CELL * 6 + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, CELL * 11 - 1); ctx.lineTo(W, CELL * 11 - 1);
    ctx.stroke();
    // Dashed center dividers
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([14, 10]);
    for (var r = 7; r <= 10; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    // Asphalt texture (subtle horizontal lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (var ar = 0; ar < 5; ar++) {
        ctx.beginPath();
        ctx.moveTo(0, CELL * 6 + ar * CELL + CELL * 0.5);
        ctx.lineTo(W, CELL * 6 + ar * CELL + CELL * 0.5);
        ctx.stroke();
    }

    // Start row 11 (grass strip with texture)
    ctx.fillStyle = '#33691e';
    ctx.fillRect(0, CELL * 11, W, CELL);
    // Grass blades
    ctx.strokeStyle = 'rgba(56,120,30,0.6)';
    ctx.lineWidth = 1;
    for (var gs2 = 4; gs2 < W; gs2 += 6) {
        ctx.beginPath();
        ctx.moveTo(gs2, CELL * 12);
        ctx.lineTo(gs2 - 2, CELL * 11 + CELL * 0.4);
        ctx.stroke();
    }
}

function drawLogs() {
    for (var r = 1; r <= 4; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            if (o.turtle) { drawTurtleGroup(o, r); continue; }
            // Gentle bobbing per log (phase computed in updateLanes)
            var bob = o.bob || 0;
            var oy = r * CELL + 4 + bob;
            var oh = o.h;
            var ow = o.w;

            // Water reflection (lighter strip below log)
            ctx.save();
            ctx.globalAlpha = 0.18 + 0.06 * Math.sin(frame * 0.05 + i);
            var reflGrad = ctx.createLinearGradient(o.x, oy + oh, o.x, oy + oh + 7);
            reflGrad.addColorStop(0, '#a1887f');
            reflGrad.addColorStop(1, 'rgba(100,120,180,0)');
            ctx.fillStyle = reflGrad;
            ctx.beginPath();
            ctx.arc(o.x + oh/2, oy + oh + 4, oh/2, 0, Math.PI, false);
            ctx.arc(o.x + ow - oh/2, oy + oh + 4, oh/2, Math.PI, 0, false);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Log body with cylindrical gradient
            var logGrad = ctx.createLinearGradient(o.x, oy, o.x, oy + oh);
            logGrad.addColorStop(0, '#b8957a');  // top highlight (lit)
            logGrad.addColorStop(0.25, '#8b6343');
            logGrad.addColorStop(0.55, '#6d4c32');
            logGrad.addColorStop(0.85, '#4a3020');
            logGrad.addColorStop(1, '#3a2416');    // bottom shadow
            ctx.fillStyle = logGrad;
            ctx.beginPath();
            ctx.arc(o.x + oh/2, oy + oh/2, oh/2, Math.PI/2, -Math.PI/2, true);
            ctx.arc(o.x + ow - oh/2, oy + oh/2, oh/2, -Math.PI/2, Math.PI/2, false);
            ctx.closePath();
            ctx.fill();

            // Wet top highlight (specular)
            ctx.save();
            ctx.globalAlpha = 0.28 + 0.10 * Math.sin(frame * 0.06 + i * 1.3);
            var shineGrad = ctx.createLinearGradient(o.x, oy, o.x, oy + oh * 0.35);
            shineGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
            shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = shineGrad;
            ctx.beginPath();
            ctx.arc(o.x + oh/2, oy + oh/2, oh/2, Math.PI/2, -Math.PI/2, true);
            ctx.arc(o.x + ow - oh/2, oy + oh/2, oh/2, -Math.PI/2, Math.PI/2, false);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Wood grain lines on body
            ctx.save();
            ctx.strokeStyle = 'rgba(40,20,8,0.35)';
            ctx.lineWidth = 1;
            for (var g = oh/2 + 8; g < ow - oh/2; g += 8) {
                ctx.beginPath();
                ctx.moveTo(o.x + g, oy + 4);
                ctx.lineTo(o.x + g, oy + oh - 4);
                ctx.stroke();
            }
            ctx.restore();

            // End cap LEFT — tree rings cross-section
            var capCx = o.x + oh/2, capCy = oy + oh/2, capR = oh/2;
            var capG = ctx.createRadialGradient(capCx - capR*0.3, capCy - capR*0.3, 0, capCx, capCy, capR);
            capG.addColorStop(0, '#c8a078');
            capG.addColorStop(0.35, '#8b5e38');
            capG.addColorStop(0.65, '#6b4020');
            capG.addColorStop(1, '#3a2010');
            ctx.fillStyle = capG;
            ctx.beginPath(); ctx.arc(capCx, capCy, capR, 0, Math.PI*2); ctx.fill();
            // tree rings (concentric)
            ctx.strokeStyle = 'rgba(40,15,5,0.4)'; ctx.lineWidth = 1;
            for (var ring = 1; ring <= 3; ring++) {
                ctx.beginPath(); ctx.arc(capCx, capCy, capR * (ring/4), 0, Math.PI*2); ctx.stroke();
            }
            // highlight dot
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.arc(capCx - capR*0.3, capCy - capR*0.3, capR*0.25, 0, Math.PI*2); ctx.fill();

            // End cap RIGHT — same
            var capRx = o.x + ow - oh/2;
            var capG2 = ctx.createRadialGradient(capRx - capR*0.3, capCy - capR*0.3, 0, capRx, capCy, capR);
            capG2.addColorStop(0, '#c8a078');
            capG2.addColorStop(0.35, '#8b5e38');
            capG2.addColorStop(0.65, '#6b4020');
            capG2.addColorStop(1, '#3a2010');
            ctx.fillStyle = capG2;
            ctx.beginPath(); ctx.arc(capRx, capCy, capR, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = 'rgba(40,15,5,0.4)'; ctx.lineWidth = 1;
            for (var ring2 = 1; ring2 <= 3; ring2++) {
                ctx.beginPath(); ctx.arc(capRx, capCy, capR * (ring2/4), 0, Math.PI*2); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.arc(capRx - capR*0.3, capCy - capR*0.3, capR*0.25, 0, Math.PI*2); ctx.fill();
        }
    }
}

// Grupo de tortugas: caparazón con patrón, aletas remando, cabeza según
// dirección. Parpadean antes de sumergirse y se ven tenues bajo el agua.
function drawTurtleGroup(o, r) {
    var st = turtleState(o);
    var lane = lanes[r];
    var oy = r * CELL + CELL / 2 + (o.bob || 0);
    var unit = o.w / o.n;
    var alpha = st === 'down' ? 0.22
              : st === 'warn' ? 0.55 + 0.4 * Math.sin(frame * 0.45)
              : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    for (var k = 0; k < o.n; k++) {
        var cx = o.x + unit * (k + 0.5), cy = oy;
        var paddle = Math.sin(frame * 0.18 + k * 1.1) * 2.2;
        var hd = lane.dir;

        // aletas (reman alternándose)
        ctx.fillStyle = '#5d8b46';
        ctx.beginPath(); ctx.ellipse(cx - 9, cy - 9 + paddle * 0.4, 5, 2.6, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx - 9, cy + 9 - paddle * 0.4, 5, 2.6,  0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 9, cy - 9 - paddle * 0.4, 5, 2.6,  0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 9, cy + 9 + paddle * 0.4, 5, 2.6, -0.5, 0, Math.PI * 2); ctx.fill();

        // cabeza (hacia la dirección del carril)
        ctx.fillStyle = '#6da653';
        ctx.beginPath(); ctx.arc(cx + hd * 13, cy, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx + hd * 15, cy - 1.8, 1, 0, Math.PI * 2); ctx.fill();

        // caparazón
        var shg = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 12);
        shg.addColorStop(0, '#8bc34a');
        shg.addColorStop(0.7, '#558b2f');
        shg.addColorStop(1, '#33691e');
        ctx.fillStyle = shg;
        ctx.beginPath(); ctx.ellipse(cx, cy, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(20,50,10,0.5)'; ctx.lineWidth = 1; ctx.stroke();

        // patrón de placas
        ctx.strokeStyle = 'rgba(20,50,10,0.4)';
        ctx.beginPath(); ctx.moveTo(cx - 8, cy - 4); ctx.lineTo(cx + 8, cy - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 9, cy + 2); ctx.lineTo(cx + 9, cy + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 4, cy - 9); ctx.lineTo(cx - 4, cy + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 4, cy - 9); ctx.lineTo(cx + 4, cy + 8); ctx.stroke();

        // brillo húmedo
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(cx - 3, cy - 4, 4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// Helper: parse hex color to rgb
function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    return { r: r, g: g, b: b };
}

function drawCars() {
    for (var r = 6; r <= 10; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 4;
            var ow = o.w, oh = o.h;
            var dir = lane.dir;
            var rgb = hexToRgb(o.color);

            // Wheels first — peek out from UNDER the body (top & bottom edges)
            var wPairX = [o.x + ow * 0.20, o.x + ow * 0.74];
            ctx.fillStyle = '#1a1a1a';
            for (var w = 0; w < 2; w++) {
                ctx.beginPath();
                ctx.ellipse(wPairX[w], oy + 1, oh * 0.20, oh * 0.16, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(wPairX[w], oy + oh - 1, oh * 0.20, oh * 0.16, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Car body: more rounded at front, squared at back
            var carGrad = ctx.createLinearGradient(o.x, oy, o.x, oy + oh);
            carGrad.addColorStop(0, 'rgba(' + Math.min(rgb.r+65,255) + ',' + Math.min(rgb.g+65,255) + ',' + Math.min(rgb.b+65,255) + ',1)');
            carGrad.addColorStop(0.45, o.color);
            carGrad.addColorStop(1, 'rgba(' + Math.max(rgb.r-55,0) + ',' + Math.max(rgb.g-55,0) + ',' + Math.max(rgb.b-55,0) + ',1)');
            ctx.fillStyle = carGrad;
            // Directional corner radii: rounded at front, sharp at back
            var fR = 9, bR = 2;
            var radii = dir > 0 ? [bR, fR, fR, bR] : [fR, bR, bR, fR];
            ctx.beginPath();
            ctx.roundRect(o.x, oy, ow, oh, radii);
            ctx.fill();
            // Body outline
            ctx.strokeStyle = 'rgba(0,0,0,0.22)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Hood line (panel crease near front)
            var hoodX = dir > 0 ? o.x + ow * 0.72 : o.x + ow * 0.28;
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hoodX, oy + oh * 0.08);
            ctx.lineTo(hoodX, oy + oh * 0.92);
            ctx.stroke();

            // Windshield (front glass, angled trapezoid)
            var windFrontX = dir > 0 ? o.x + ow * 0.58 : o.x + ow * 0.12;
            var windRearX  = dir > 0 ? o.x + ow * 0.50 : o.x + ow * 0.20;
            var windW = ow * 0.22;
            ctx.fillStyle = 'rgba(160,215,255,0.6)';
            ctx.beginPath();
            ctx.moveTo(windFrontX, oy + oh * 0.12);
            ctx.lineTo(windFrontX + windW * dir, oy + oh * 0.18);
            ctx.lineTo(windFrontX + windW * dir, oy + oh * 0.82);
            ctx.lineTo(windFrontX, oy + oh * 0.88);
            ctx.closePath();
            ctx.fill();

            // Cabin / roof glass
            var cabinX = dir > 0 ? o.x + ow * 0.25 : o.x + ow * 0.32;
            var cabinW = ow * 0.28;
            ctx.fillStyle = 'rgba(140,200,245,0.45)';
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.roundRect(cabinX, oy + oh * 0.15, cabinW, oh * 0.7, 2);
            ctx.fill();
            ctx.stroke();

            // Side mirrors (small bumps on top and bottom edges)
            var mirrorX = o.x + ow * (dir > 0 ? 0.62 : 0.30);
            ctx.fillStyle = 'rgba(' + Math.max(rgb.r-40,0) + ',' + Math.max(rgb.g-40,0) + ',' + Math.max(rgb.b-40,0) + ',1)';
            ctx.beginPath();
            ctx.roundRect(mirrorX, oy - 3, ow * 0.12, 4, 1);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(mirrorX, oy + oh - 1, ow * 0.12, 4, 1);
            ctx.fill();

            // Headlights (bright circles at front)
            var frontEdge = dir > 0 ? o.x + ow - 3 : o.x + 3;
            ctx.fillStyle = '#fffde7';
            ctx.beginPath();
            ctx.arc(frontEdge, oy + oh * 0.22, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(frontEdge, oy + oh * 0.78, 3.5, 0, Math.PI * 2);
            ctx.fill();
            // Inner bright spot
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(frontEdge, oy + oh * 0.22, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(frontEdge, oy + oh * 0.78, 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Taillights (red rectangles at rear)
            var rearEdge = dir > 0 ? o.x : o.x + ow - 5;
            ctx.fillStyle = '#ef5350';
            ctx.fillRect(rearEdge, oy + 2, 5, oh * 0.28);
            ctx.fillRect(rearEdge, oy + oh - oh * 0.28 - 2, 5, oh * 0.28);
            // Tail light highlight
            ctx.fillStyle = 'rgba(255,160,150,0.6)';
            ctx.fillRect(rearEdge + 1, oy + 3, 2, oh * 0.14);
            ctx.fillRect(rearEdge + 1, oy + oh - oh * 0.28 - 1, 2, oh * 0.14);

            // Speed lines on fast lanes (speed > 2.0)
            if (Math.abs(lane.speed) > 2.0) {
                ctx.save();
                ctx.globalAlpha = 0.12;
                ctx.strokeStyle = o.color;
                ctx.lineWidth = 1;
                for (var sl = 0; sl < 3; sl++) {
                    var slX = o.x - dir * (10 + sl * 8);
                    var slLen = (lane.speed - 2.0) * 8;
                    ctx.beginPath();
                    ctx.moveTo(slX, oy + oh * (0.25 + sl * 0.25));
                    ctx.lineTo(slX - dir * slLen, oy + oh * (0.25 + sl * 0.25));
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    }
}

var frogRidingX = null;

// Draw the frog shape at (cx, cy) with given radius
function drawFrogShape(cx, cy, r, moving) {
    // Jump animation: frogMoveFlash goes 8→0 after each hop
    var jumpT = (moving && frogMoveFlash > 0) ? frogMoveFlash / 8 : 0;
    var jE = jumpT * jumpT * (3 - 2 * jumpT); // smoothstep easing

    // Idle breathing when not jumping
    var breathe = (moving && jumpT < 0.01) ? Math.sin(frame * 0.04) * 0.012 : 0;

    var brightness = jumpT;
    var g1 = Math.min(255, 150 + Math.floor(brightness * 80));
    var bodyColor = 'rgb(56,' + g1 + ',56)';
    var darkGreen = '#2d5a27';
    var lightGreen = 'rgb(100,' + Math.min(255, 200 + Math.floor(brightness * 30)) + ',80)';

    // ======= BACK LEGS (behind body) =======
    // Jump: legs spread wider and extend further back/outward
    var bThighX  = r * (0.60 + jE * 0.28);
    var bThighY  = r * (0.20 - jE * 0.05);
    var bThighAng = Math.PI * (0.32 + jE * 0.22);
    var bLowerX  = r * (0.92 + jE * 0.32);
    var bLowerY  = r * (0.48 + jE * 0.18);
    var bLowerAng = Math.PI * (0.08 - jE * 0.18);

    ctx.fillStyle = darkGreen;
    // Left back thigh
    ctx.beginPath();
    ctx.ellipse(cx - bThighX, cy + bThighY, r * 0.34, r * 0.17, bThighAng, 0, Math.PI * 2);
    ctx.fill();
    // Left back lower leg
    ctx.beginPath();
    ctx.ellipse(cx - bLowerX, cy + bLowerY, r * 0.17, r * (0.28 + jE * 0.1), bLowerAng, 0, Math.PI * 2);
    ctx.fill();
    // Left toes (3 small toe pads)
    var ltX = cx - bLowerX - r * (0.12 + jE * 0.06);
    var ltY = cy + bLowerY + r * (0.30 + jE * 0.08);
    ctx.fillStyle = '#1a4a14';
    for (var ti = -1; ti <= 1; ti++) {
        ctx.beginPath();
        ctx.arc(ltX + ti * r * 0.09, ltY + Math.abs(ti) * r * 0.05, r * 0.055, 0, Math.PI * 2);
        ctx.fill();
    }

    // Right back thigh
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(cx + bThighX, cy + bThighY, r * 0.34, r * 0.17, -bThighAng, 0, Math.PI * 2);
    ctx.fill();
    // Right back lower leg
    ctx.beginPath();
    ctx.ellipse(cx + bLowerX, cy + bLowerY, r * 0.17, r * (0.28 + jE * 0.1), -bLowerAng, 0, Math.PI * 2);
    ctx.fill();
    // Right toes
    var rtX = cx + bLowerX + r * (0.12 + jE * 0.06);
    var rtY = cy + bLowerY + r * (0.30 + jE * 0.08);
    ctx.fillStyle = '#1a4a14';
    for (var ti = -1; ti <= 1; ti++) {
        ctx.beginPath();
        ctx.arc(rtX + ti * r * 0.09, rtY + Math.abs(ti) * r * 0.05, r * 0.055, 0, Math.PI * 2);
        ctx.fill();
    }

    // ======= BODY =======
    var squashT = landSquash / 8;
    var bodyRx = r * 0.62 * (1 - jE * 0.06 + breathe + squashT * 0.22);
    var bodyRy = r * 0.50 * (1 + jE * 0.14 + breathe - squashT * 0.18);
    var bodyGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r * 0.75);
    bodyGrad.addColorStop(0, lightGreen);
    bodyGrad.addColorStop(0.6, bodyColor);
    bodyGrad.addColorStop(1, darkGreen);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body outline
    ctx.strokeStyle = 'rgba(30,70,20,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Belly (lighter underside)
    ctx.fillStyle = 'rgba(180,230,160,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 0.36, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal stripe
    ctx.strokeStyle = 'rgba(25,65,15,0.38)';
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyRy + r * 0.06);
    ctx.lineTo(cx, cy + bodyRy - r * 0.1);
    ctx.stroke();

    // Back spots
    ctx.fillStyle = 'rgba(25,65,15,0.42)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.21, cy - r * 0.12, r * 0.09, r * 0.07, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.21, cy - r * 0.12, r * 0.09, r * 0.07, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 0.07, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // ======= FRONT LEGS =======
    // Jump: arms reach slightly forward (toward head)
    var fLegX = r * (0.52 + jE * 0.04);
    var fLegY = r * (0.10 - jE * 0.12);
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(cx - fLegX, cy + fLegY, r * 0.20, r * 0.11, Math.PI * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + fLegX, cy + fLegY, r * 0.20, r * 0.11, -Math.PI * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Front toes (3 pads per side)
    ctx.fillStyle = '#1a4a14';
    var ftOff = [[-0.06, -0.09], [0.0, 0.0], [-0.06, 0.09]];
    for (var fi = 0; fi < 3; fi++) {
        ctx.beginPath();
        ctx.arc(cx - fLegX - r * (0.18 + ftOff[fi][0]), cy + fLegY + r * ftOff[fi][1], r * 0.048, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + fLegX + r * (0.18 + ftOff[fi][0]), cy + fLegY + r * ftOff[fi][1], r * 0.048, 0, Math.PI * 2);
        ctx.fill();
    }

    // ======= EYES =======
    var eyeY = cy - r * 0.33;
    var eyeOffX = r * 0.31;
    var blinking = moving && (frame % 110 < 5);

    // Eye bulge/socket
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, eyeY, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX, eyeY, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    if (blinking) {
        // Blink: horizontal squint
        ctx.strokeStyle = darkGreen;
        ctx.lineWidth = r * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - eyeOffX - r * 0.1, eyeY);
        ctx.lineTo(cx - eyeOffX + r * 0.1, eyeY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + eyeOffX - r * 0.1, eyeY);
        ctx.lineTo(cx + eyeOffX + r * 0.1, eyeY);
        ctx.stroke();
    } else {
        // Sclera
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.arc(cx - eyeOffX, eyeY, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffX, eyeY, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Gold iris
        ctx.fillStyle = '#f9a825';
        ctx.beginPath();
        ctx.arc(cx - eyeOffX + r * 0.02, eyeY + r * 0.02, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffX + r * 0.02, eyeY + r * 0.02, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        // Vertical slit pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(cx - eyeOffX + r * 0.02, eyeY + r * 0.02, r * 0.033, r * 0.072, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + eyeOffX + r * 0.02, eyeY + r * 0.02, r * 0.033, r * 0.072, 0, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(cx - eyeOffX - r * 0.04, eyeY - r * 0.04, r * 0.034, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeOffX - r * 0.04, eyeY - r * 0.04, r * 0.034, 0, Math.PI * 2);
        ctx.fill();
    }

    // Nostrils
    ctx.fillStyle = 'rgba(30,70,20,0.6)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.08, cy - r * 0.17, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.08, cy - r * 0.17, r * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (curved line)
    ctx.strokeStyle = darkGreen;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.04, r * 0.22, 0.3, Math.PI - 0.3, false);
    ctx.stroke();
}

// Flash on movement + hop tween state
var frogMoveFlash = 0;
var frogHop = null; // { fromX, fromY, t, duration }

// Orientación de la rana (0 = arriba) con giro suavizado al moverse
var frogAngle = 0;
var frogTargetAngle = 0;
var frogUprightTimer = 0; // frames antes de volver a mirar al frente

// Buffer de input: guarda el siguiente salto si llega al final del tween
var queuedMove = null;

function drawFrog() {
    if (deathAnim && !deathAnim.done) return; // hide frog during death

    // Logical pixel position (tracks log movement each frame)
    var logX = (frog.row >= 1 && frog.row <= 4 && frogRidingX !== null)
        ? frogRidingX
        : (frog.col - 0.5) * CELL;
    var logY = frog.row * CELL + CELL / 2;

    var frogCx, frogCy;
    var frogR = CELL * 0.48;

    if (frogHop && frogHop.t < frogHop.duration) {
        frogHop.t++;
        var p = frogHop.t / frogHop.duration;
        var eased = p * p * (3 - 2 * p); // smoothstep

        // Interpolate from saved start toward current logical position
        // (the "to" drifts naturally with log movement)
        frogCx = frogHop.fromX + (logX - frogHop.fromX) * eased;
        frogCy = frogHop.fromY + (logY - frogHop.fromY) * eased;

        // Parabolic arc — taller for vertical hops, shallower for sideways
        var dxHop = Math.abs(logX - frogHop.fromX);
        var dyHop = Math.abs(logY - frogHop.fromY);
        var arcH = dyHop > dxHop ? CELL * 0.55 : CELL * 0.38;
        frogCy -= Math.sin(p * Math.PI) * arcH;

        // Slight scale-down at arc peak (height illusion)
        frogR *= 1 - Math.sin(p * Math.PI) * 0.13;

        // Landing shadow at destination (shows where frog will land)
        ctx.save();
        ctx.globalAlpha = 0.28 * (1 - p * 0.5);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(logX, logY + 3, CELL * 0.32 * (0.4 + eased * 0.6), CELL * 0.10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Take-off ripple (expanding ring at origin)
        if (frogHop.t <= 5) {
            var rP = frogHop.t / 5;
            ctx.save();
            ctx.globalAlpha = (1 - rP) * 0.5;
            ctx.strokeStyle = '#a8e063';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(frogHop.fromX, frogHop.fromY, CELL * 0.1 + CELL * 0.28 * rP, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    } else {
        frogCx = logX;
        frogCy = logY;
        if (frogHop) { landSquash = 8; } // just landed
        frogHop = null;
        // Ejecutar el salto en cola (encadena saltos con fluidez)
        if (queuedMove && !deathAnim) {
            var qm = queuedMove; queuedMove = null;
            moveFrog(qm[0], qm[1]);
        }
        // Montada en tronco/tortuga: hereda el balanceo del agua
        if (frog.row >= 1 && frog.row <= 4) {
            var riding = getFrogOnLog();
            if (riding) frogCy += riding.log.bob || 0;
        }
        // Quieta un momento: vuelve a mirar al frente (no se queda de lado)
        if (frogUprightTimer > 0) frogUprightTimer--;
        else frogTargetAngle = 0;
    }
    if (landSquash > 0) landSquash--;

    if (frogMoveFlash > 0) frogMoveFlash--;

    // Giro suavizado hacia la dirección del último salto (camino más corto)
    var dAng = frogTargetAngle - frogAngle;
    while (dAng >  Math.PI) dAng -= Math.PI * 2;
    while (dAng < -Math.PI) dAng += Math.PI * 2;
    frogAngle += dAng * 0.45;
    if (Math.abs(dAng) < 0.02) frogAngle = frogTargetAngle;

    ctx.save();
    ctx.translate(frogCx, frogCy);
    ctx.rotate(frogAngle);
    drawFrogShape(0, 0, frogR, true);

    // Lengüetazo ocasional en reposo (en zonas seguras, mirando al frente)
    var safeRow = (frog.row === 5 || frog.row === 11);
    var tCyc = frame % 300;
    if (safeRow && !frogHop && tCyc < 16) {
        var tLen = Math.sin((tCyc / 16) * Math.PI) * frogR * 1.1;
        ctx.strokeStyle = '#ef6c8f';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -frogR * 0.15);
        ctx.lineTo(0, -frogR * 0.3 - tLen);
        ctx.stroke();
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath();
        ctx.ellipse(0, -frogR * 0.3 - tLen, 2.6, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawDeathAnim() {
    if (!deathAnim) return;
    deathAnim.timer++;

    var isWater = deathAnim.cause === 'river';

    if (deathAnim.timer <= 8) {
        // Flash inicial (blanco en carretera, espuma azulada en agua)
        var flashAlpha = 1 - (deathAnim.timer / 8);
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.85;
        ctx.fillStyle = isWater ? '#bbdefb' : '#ffffff';
        ctx.beginPath();
        ctx.arc(deathAnim.x, deathAnim.y, CELL * 0.6 * (1 + deathAnim.timer * 0.15), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (isWater) {
        // Anillos concéntricos que se expanden en la superficie
        ctx.save();
        for (var ring = 0; ring < 2; ring++) {
            var rt = deathAnim.timer - ring * 6;
            if (rt > 0 && rt < 28) {
                ctx.globalAlpha = (1 - rt / 28) * 0.55;
                ctx.strokeStyle = '#e3f2fd';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(deathAnim.x, deathAnim.y, CELL * 0.15 + rt * 1.4, (CELL * 0.15 + rt * 1.4) * 0.4, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        // Burbujas subiendo (precomputadas al morir)
        for (var bi = 0; bi < deathAnim.bubbles.length; bi++) {
            var bb = deathAnim.bubbles[bi];
            var bt = deathAnim.timer - bb.delay;
            if (bt <= 0 || bt > 26) continue;
            ctx.globalAlpha = (1 - bt / 26) * 0.7;
            ctx.strokeStyle = '#e3f2fd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(deathAnim.x + bb.dx, deathAnim.y - bt * bb.rise, bb.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    } else {
        // Atropello: rana aplastada que se desvanece + estrellitas orbitando
        var sq = Math.max(0, 1 - deathAnim.timer / 34);
        if (sq > 0) {
            ctx.save();
            ctx.globalAlpha = sq * 0.9;
            // cuerpo aplastado
            ctx.fillStyle = '#46a843';
            ctx.beginPath();
            ctx.ellipse(deathAnim.x, deathAnim.y + CELL * 0.18, CELL * 0.42, CELL * 0.13, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2d5a27'; ctx.lineWidth = 1; ctx.stroke();
            // patas desparramadas
            ctx.strokeStyle = '#2d5a27'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(deathAnim.x - CELL * 0.3, deathAnim.y + CELL * 0.16); ctx.lineTo(deathAnim.x - CELL * 0.52, deathAnim.y + CELL * 0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(deathAnim.x + CELL * 0.3, deathAnim.y + CELL * 0.16); ctx.lineTo(deathAnim.x + CELL * 0.52, deathAnim.y + CELL * 0.3); ctx.stroke();
            // ojos en X
            ctx.lineWidth = 1.6;
            for (var xe = -1; xe <= 1; xe += 2) {
                var exX = deathAnim.x + xe * CELL * 0.14, exY = deathAnim.y + CELL * 0.1;
                ctx.beginPath(); ctx.moveTo(exX - 2.5, exY - 2.5); ctx.lineTo(exX + 2.5, exY + 2.5); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(exX + 2.5, exY - 2.5); ctx.lineTo(exX - 2.5, exY + 2.5); ctx.stroke();
            }
            // estrellitas dando vueltas sobre la cabeza
            ctx.fillStyle = '#ffd54f';
            for (var st = 0; st < 3; st++) {
                var sa = deathAnim.timer * 0.18 + st * (Math.PI * 2 / 3);
                var sx = deathAnim.x + Math.cos(sa) * CELL * 0.32;
                var sy = deathAnim.y - CELL * 0.18 + Math.sin(sa) * CELL * 0.1;
                ctx.beginPath();
                for (var sp = 0; sp < 10; sp++) {
                    var spA = sa + (sp / 10) * Math.PI * 2;
                    var spR = sp % 2 === 0 ? 3 : 1.4;
                    var px2 = sx + Math.cos(spA) * spR, py2 = sy + Math.sin(spA) * spR;
                    if (sp === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
                }
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
    }

    // Update and draw particles
    for (var i = deathAnim.particles.length - 1; i >= 0; i--) {
        var p = deathAnim.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;
        if (p.life <= 0) { deathAnim.particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (deathAnim.timer > 30 && deathAnim.particles.length === 0) {
        deathAnim.done = true;
        deathAnim = null;
    }
}

function updateAndDrawExhaust() {
    for (var i = exhaustParticles.length - 1; i >= 0; i--) {
        var p = exhaustParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.r += 0.15;
        p.life--;
        if (p.life <= 0) { exhaustParticles.splice(i, 1); continue; }
        var a = (p.life / p.maxLife) * 0.25;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ccc';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function updateAndDrawJumpParticles() {
    for (var i = jumpParticles.length - 1; i >= 0; i--) {
        var p = jumpParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        if (p.life <= 0) { jumpParticles.splice(i, 1); continue; }
        var a = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = a * 0.75;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function getFrogOnLog() {
    if (frog.row < 1 || frog.row > 4) return null;
    var lane = lanes[frog.row];
    if (!lane) return null;
    var fx, fy = frog.row * CELL + 4;
    if (frogRidingX !== null) fx = frogRidingX - 2;
    else fx = (frog.col - 1) * CELL + 2;
    for (var i = 0; i < lane.objects.length; i++) {
        var o = lane.objects[i];
        if (o.turtle && turtleState(o) === 'down') continue; // sumergida: no sostiene
        if (fx < o.x + o.w && fx + CELL - 4 > o.x) return { log: o, lane: lane };
    }
    return null;
}

function checkDeath() {
    if (frog.row >= 1 && frog.row <= 4) {
        var riding = getFrogOnLog();
        if (!riding) return 'river';
        if (frogRidingX < 0 || frogRidingX > W) return 'river';
    }
    if (frog.row >= 6 && frog.row <= 10) {
        var lane = lanes[frog.row];
        if (!lane) return null;
        var fx = (frog.col - 1) * CELL + 4;
        var fy = frog.row * CELL + 4;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            if (fx < o.x + o.w - 2 && fx + CELL - 8 > o.x + 2) return 'car';
        }
    }
    return null;
}

function triggerDeathAnim(cause, callback) {
    var fx, fy;
    if (frog.row >= 1 && frog.row <= 4 && frogRidingX !== null) {
        fx = frogRidingX;
    } else {
        fx = (frog.col - 0.5) * CELL;
    }
    fy = frog.row * CELL + CELL / 2;

    var isWater = cause === 'river';
    var parts = [];
    var colors = isWater
        ? ['#64b5f6', '#90caf9', '#bbdefb', '#e3f2fd', '#42a5f5']
        : ['#56ab2f', '#a8e063', '#2d5a27', '#8bc34a', '#cddc39'];
    var nParts = isWater ? 10 : 6;
    for (var i = 0; i < nParts; i++) {
        var angle = (i / nParts) * Math.PI * 2 + Math.random() * 0.4;
        var speed = 2.5 + Math.random() * 3;
        parts.push({
            x: fx, y: fy,
            vx: Math.cos(angle) * speed * (isWater ? 0.8 : 1),
            vy: Math.sin(angle) * speed - (isWater ? 2.6 : 1.5),
            color: colors[i % colors.length],
            size: 3 + Math.random() * 4,
            life: 20 + Math.random() * 12,
            maxLife: 32
        });
    }

    // Burbujas que suben tras la zambullida (precomputadas, sin random en render)
    var bubbles = [];
    if (isWater) {
        for (var b = 0; b < 6; b++) {
            bubbles.push({
                dx: (Math.random() - 0.5) * CELL * 0.6,
                r: 1.5 + Math.random() * 2.5,
                rise: 0.6 + Math.random() * 0.5,
                delay: 4 + b * 4
            });
        }
    }

    deathAnim = { x: fx, y: fy, cause: cause, particles: parts, bubbles: bubbles, timer: 0, done: false };

    setTimeout(function() {
        if (callback) callback();
    }, 500);
}

function respawnFrog() {
    frog.col = 5; frog.row = 11; frogRidingX = null;
    frogAngle = 0; frogTargetAngle = 0; frogUprightTimer = 0; queuedMove = null; frogHop = null;
}

function die(cause) {
    lives--;
    updateHUD();
    queuedMove = null;
    if (lives <= 0) {
        // Still show anim then game over
        triggerDeathAnim(cause, function() { gameOver(); });
        respawnFrog();
        return;
    }
    triggerDeathAnim(cause, function() {
        respawnFrog();
    });
}

function checkGoal() {
    if (frog.row !== 0) return false;
    var fx = frogRidingX !== null ? frogRidingX : (frog.col - 0.5) * CELL;
    for (var i = 0; i < GOAL_SLOTS.length; i++) {
        var gs = GOAL_SLOTS[i];
        var gx = (gs - 1) * CELL + CELL / 2;
        if (Math.abs(fx - gx) < CELL * 0.7 && filledGoals.indexOf(gs) < 0) {
            filledGoals.push(gs);
            score += 50;
            updateHUD();
            GameAudio.goal();
            respawnFrog();
            if (filledGoals.length >= GOAL_SLOTS.length) {
                score += 200;
                updateHUD();
                filledGoals = [];
                speedUpLanes();
                GameAudio.win();
            }
            return true;
        }
    }
    return false;
}

function speedUpLanes() {
    for (var r = 1; r <= 10; r++) {
        if (lanes[r]) lanes[r].speed *= 1.15;
    }
}

var frame = 0;
var dying = false;

var lastFrameTs = 0;
function gameLoop(ts) {
    if (!isPlaying) return;
    // Throttle to ~60fps on high-refresh screens
    if (ts - lastFrameTs < 15) { animFrameId = requestAnimationFrame(gameLoop); return; }
    lastFrameTs = ts;
    frame++;

    updateLanes();

    // En el aire (salto en curso) no hay deriva ni muerte: se resuelve al aterrizar
    var hopping = frogHop && frogHop.t < frogHop.duration;

    // Move frog with log
    if (!hopping && frog.row >= 1 && frog.row <= 4) {
        var lane = lanes[frog.row];
        if (lane) {
            if (frogRidingX === null) frogRidingX = (frog.col - 0.5) * CELL;
            frogRidingX += lane.speed * lane.dir;
        }
    }

    // Check death (only if not already in death anim)
    if (!deathAnim && !hopping) {
        var cause = checkDeath();
        if (cause) {
            if (cause === 'river') GameAudio.splash();
            else GameAudio.hit();
            die(cause);
        }
    }

    // Check goal
    if (!deathAnim && !hopping && frog.row === 0) checkGoal();

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawLogs();
    drawCars();
    drawFrog();
    drawDeathAnim();
    updateAndDrawExhaust();
    updateAndDrawJumpParticles();

    animFrameId = requestAnimationFrame(gameLoop);
}

function moveFrog(dr, dc) {
    if (!isPlaying) return;
    if (deathAnim) return; // can't move during death
    if (frogHop && frogHop.t < frogHop.duration) {
        // Buffer del siguiente salto en la recta final del tween
        if (frogHop.duration - frogHop.t <= 6) queuedMove = [dr, dc];
        return;
    }

    // Orientar la rana hacia el movimiento (vuelve al frente al quedarse quieta)
    if (dr === -1)     frogTargetAngle = 0;
    else if (dr === 1) frogTargetAngle = Math.PI;
    else if (dc === 1) frogTargetAngle = Math.PI / 2;
    else if (dc === -1) frogTargetAngle = -Math.PI / 2;
    frogUprightTimer = 16;

    var curRow = frog.row;
    var onRiver = (curRow >= 1 && curRow <= 4);
    var lateralOnRiver = (dr === 0 && dc !== 0 && onRiver);

    // Montada en tronco/tortuga frog.col queda desfasado: derivar de la X real en píxeles
    var baseCol = frog.col;
    if (onRiver && frogRidingX !== null) {
        baseCol = Math.max(1, Math.min(COLS, Math.round(frogRidingX / CELL + 0.5)));
    }

    var nr = curRow + dr;
    var nc = baseCol + dc;
    if (nr < 0 || nr > 11) return;
    // For lateral river moves, skip column bounds — pixel clamp handles limits
    if (!lateralOnRiver && (nc < 1 || nc > COLS)) return;

    // Save current visual position as hop start
    var fromX = (onRiver && frogRidingX !== null)
        ? frogRidingX
        : (frog.col - 0.5) * CELL;
    var fromY = curRow * CELL + CELL / 2;

    // Update logical position immediately (collision detection uses this)
    frog.row = nr;
    frog.col = nc;
    frogMoveFlash = 12;
    if (nr >= 1 && nr <= 4) {
        if (lateralOnRiver) {
            // Half-cell lateral step on river: easier to position on logs
            var newRX = fromX + dc * CELL * 0.5;
            newRX = Math.max(CELL * 0.25, Math.min(W - CELL * 0.25, newRX));
            frogRidingX = newRX;
            frog.col = Math.max(1, Math.min(COLS, Math.round(newRX / CELL + 0.5)));
        } else if (onRiver && frogRidingX !== null) {
            // Salto vertical dentro del río: conserva la X exacta (salto recto)
            frogRidingX = Math.max(CELL * 0.25, Math.min(W - CELL * 0.25, fromX));
        } else {
            frogRidingX = (nc - 0.5) * CELL;
        }
    } else {
        frogRidingX = null;
    }

    // Kick off hop tween
    frogHop = { fromX: fromX, fromY: fromY, t: 0, duration: 10 };

    // Spawn jump dust/ripple particles
    var isRiver = (frog.row >= 1 && frog.row <= 4);
    var pColors = isRiver ? ['#64b5f6','#90caf9','#bbdefb'] : ['#c8a96e','#a1887f','#8d6e63'];
    for (var pi = 0; pi < 5; pi++) {
        var ang = (pi / 5) * Math.PI * 2;
        jumpParticles.push({
            x: fromX + Math.cos(ang) * 4,
            y: fromY + Math.sin(ang) * 4,
            vx: Math.cos(ang) * (0.8 + Math.random() * 0.8),
            vy: Math.sin(ang) * (0.8 + Math.random() * 0.8) - 0.5,
            r: 3 + Math.random() * 2,
            life: 10 + Math.random() * 6 | 0,
            maxLife: 16,
            color: pColors[pi % pColors.length]
        });
    }

    GameAudio.hop();

    if (nr > 0) score += 1;
    updateHUD();
}

function updateHUD() {
    if (score > highScore) { highScore = score; localStorage.setItem('froggerHigh', highScore); }
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lives').textContent = lives;
    document.getElementById('mobileScore').textContent = 'P:' + score + ' V:' + lives;
}

function startGame() {
    GameAudio.start();
    respawnFrog();
    score = 0; lives = 3; frame = 0;
    filledGoals = [];
    deathAnim = null;
    frogMoveFlash = 0;
    exhaustParticles = [];
    jumpParticles = [];
    landSquash = 0;
    isPlaying = true;
    initLanes();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    cancelAnimationFrame(animFrameId);
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// Keyboard
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); moveFrog(-1, 0); }
    if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); moveFrog(1, 0); }
    if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); moveFrog(0, -1); }
    if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); moveFrog(0, 1); }
});

// Touch controls
function addTap(id, dr, dc) {
    var btn = document.getElementById(id);
    btn.addEventListener('click', function() { moveFrog(dr, dc); });
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); moveFrog(dr, dc); }, { passive: false });
}
addTap('btnUp', -1, 0);
addTap('btnDown', 1, 0);
addTap('btnLeft', 0, -1);
addTap('btnRight', 0, 1);

// Swipe gestures en el canvas
(function() {
    var swipeStartX, swipeStartY;
    var MIN_SWIPE = 30;

    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        var tc = document.getElementById('touchControls');
        if (tc) tc.style.display = 'none';
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        var dx = e.changedTouches[0].clientX - swipeStartX;
        var dy = e.changedTouches[0].clientY - swipeStartY;
        var absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < MIN_SWIPE) {
            // TAP: iniciar o reiniciar si no está jugando
            if (!isPlaying) { startGame(); }
        } else if (absDx > absDy) {
            if (dx > 0) { moveFrog(0, 1); }
            else        { moveFrog(0, -1); }
        } else {
            if (dy > 0) { moveFrog(1, 0); }
            else        { moveFrog(-1, 0); }
        }
    }, { passive: false });
})();

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
initLanes();
ctx.fillStyle = '#1a237e'; ctx.fillRect(0, 0, W, H);
updateHUD();

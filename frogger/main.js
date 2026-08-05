// Frogger
var canvas = document.getElementById('froggerCanvas');
var ctx = canvas.getContext('2d');
var W = canvas.width;   // 400
var H = canvas.height;  // 480

var COLS = 10, ROWS = 12;
var CELL = W / COLS; // 40

var score, highScore, lives, isPlaying, animFrameId;
highScore = GameStore.getNum('froggerHigh', 0);

/* Gradient cache. Only keys that are provably bounded go in here — anything
   keyed on a scrolling or bobbing coordinate would grow every frame. */
var gMemo = GU.gradientMemo();

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
        ctx.fillStyle = gMemo('pad:' + gx + ':' + isFilled, function () {
            var g = ctx.createRadialGradient(gx + CELL/2 - 3, CELL/2 - 4, 1, gx + CELL/2, CELL/2, CELL/2 - 3);
            g.addColorStop(0, isFilled ? '#66bb6a' : '#1a5276');
            g.addColorStop(1, isFilled ? '#2e7d32' : '#0d3b6e');
            return g;
        });
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
    /* Stop alphas are the originals divided by 1.6, with that 1.6 moved into
       globalAlpha — identical output, one gradient instead of twelve. */
    ctx.fillStyle = gMemo('caustic', function () {
        var g = ctx.createLinearGradient(0, CELL, 0, CELL * 5);
        g.addColorStop(0,   'rgba(140,200,255,0.625)');
        g.addColorStop(0.5, 'rgba(160,220,255,1)');
        g.addColorStop(1,   'rgba(100,170,220,0.3125)');
        return g;
    });
    for (var cCol = 0; cCol < 12; cCol++) {
        var cBase = (cCol * 34 + frame * 0.4) % W;
        ctx.globalAlpha = (0.06 + 0.04 * Math.sin(frame * 0.03 + cCol)) * 1.6;
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
        var paddle = Math.sin(frame * 0.18 + k * 1.1) * 2.4;
        var hd = lane.dir;
        var R = CELL * 0.30;

        /* flippers — front pair rows forward, rear pair trails */
        ctx.fillStyle = '#4f7c3a';
        ctx.beginPath();
        ctx.ellipse(cx + hd * R * 0.52, cy - R * 0.74 + paddle * 0.5, R * 0.42, R * 0.20, hd * -0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + hd * R * 0.52, cy + R * 0.74 - paddle * 0.5, R * 0.42, R * 0.20, hd * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - hd * R * 0.60, cy - R * 0.66 - paddle * 0.4, R * 0.34, R * 0.17, hd * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - hd * R * 0.60, cy + R * 0.66 + paddle * 0.4, R * 0.34, R * 0.17, hd * -0.6, 0, Math.PI * 2);
        ctx.fill();

        /* head */
        ctx.fillStyle = '#66a04d';
        ctx.beginPath();
        ctx.ellipse(cx + hd * R * 1.02, cy, R * 0.30, R * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f0f0f';
        ctx.beginPath();
        ctx.arc(cx + hd * R * 1.12, cy - R * 0.10, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + hd * R * 1.12, cy + R * 0.10, R * 0.07, 0, Math.PI * 2);
        ctx.fill();

        /* tail */
        ctx.fillStyle = '#4f7c3a';
        ctx.beginPath();
        ctx.moveTo(cx - hd * R * 0.92, cy - R * 0.12);
        ctx.lineTo(cx - hd * R * 1.24, cy);
        ctx.lineTo(cx - hd * R * 0.92, cy + R * 0.12);
        ctx.closePath();
        ctx.fill();

        /* shell: domed carapace with a clear rim */
        var shg = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.34, R * 0.05, cx, cy, R);
        shg.addColorStop(0, '#9ccc65');
        shg.addColorStop(0.55, '#5f9236');
        shg.addColorStop(1, '#33601c');
        ctx.fillStyle = shg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R, R * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a4d16';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        /* rim separating carapace from scutes */
        ctx.strokeStyle = 'rgba(40,80,22,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * 0.70, R * 0.58, 0, 0, Math.PI * 2);
        ctx.stroke();

        /* five central scutes — a simple readable pattern, not a grid */
        ctx.fillStyle = 'rgba(40,84,20,0.30)';
        for (var sc = -1; sc <= 1; sc++) {
            ctx.beginPath();
            ctx.ellipse(cx + sc * R * 0.40, cy, R * 0.17, R * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(cx, cy - R * 0.40, R * 0.15, R * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy + R * 0.40, R * 0.15, R * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();

        /* wet highlight */
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(cx - R * 0.30, cy - R * 0.36, R * 0.26, R * 0.14, -0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/* Cars, seen from above: tapered nose, inset roof, glass only where glass
 * belongs (windscreen / rear window / side slits), wheels peeking past the
 * flanks, and a cast shadow so they sit on the asphalt instead of floating. */
function drawCars() {
    for (var r = 6; r <= 10; r++) {
        var lane = lanes[r];
        if (!lane) continue;
        for (var i = 0; i < lane.objects.length; i++) {
            var o = lane.objects[i];
            var oy = r * CELL + 5;
            var ow = o.w, oh = o.h - 2;
            var dir = lane.dir;
            var cy = oy + oh / 2;
            // nose/tail in world x
            var nose = dir > 0 ? o.x + ow : o.x;
            var tail = dir > 0 ? o.x : o.x + ow;
            var sgn  = dir > 0 ? 1 : -1;

            /* ── cast shadow ── */
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.beginPath();
            ctx.roundRect(o.x + 2, oy + oh * 0.30, ow, oh * 0.86, oh * 0.30);
            ctx.fill();

            /* ── wheels (behind the body, peeking past both flanks) ── */
            ctx.fillStyle = '#141414';
            var axle = [0.24, 0.76];
            for (var a = 0; a < 2; a++) {
                var wx = o.x + ow * axle[a] - oh * 0.15;
                ctx.beginPath();
                ctx.roundRect(wx, oy - oh * 0.07, oh * 0.30, oh * 0.20, 1.5);
                ctx.fill();
                ctx.beginPath();
                ctx.roundRect(wx, oy + oh - oh * 0.13, oh * 0.30, oh * 0.20, 1.5);
                ctx.fill();
            }

            /* ── body: tapered nose, squarer tail ── */
            ctx.fillStyle = gMemo('car:' + oy + ':' + oh + ':' + o.color, function () {
                var g = ctx.createLinearGradient(0, oy, 0, oy + oh);
                g.addColorStop(0, shade(o.color, 54));
                g.addColorStop(0.42, o.color);
                g.addColorStop(1, shade(o.color, -58));
                return g;
            });
            ctx.beginPath();
            ctx.moveTo(tail + sgn * oh * 0.16, oy);
            ctx.lineTo(nose - sgn * oh * 0.40, oy);
            // rounded nose
            ctx.quadraticCurveTo(nose, oy, nose, cy);
            ctx.quadraticCurveTo(nose, oy + oh, nose - sgn * oh * 0.40, oy + oh);
            ctx.lineTo(tail + sgn * oh * 0.16, oy + oh);
            // squarer tail
            ctx.quadraticCurveTo(tail, oy + oh, tail, cy);
            ctx.quadraticCurveTo(tail, oy, tail + sgn * oh * 0.16, oy);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.30)';
            ctx.lineWidth = 0.9;
            ctx.stroke();

            /* ── roof: inset panel in a darker tint of the body ── */
            var roofX = dir > 0 ? o.x + ow * 0.20 : o.x + ow * 0.30;
            var roofW = ow * 0.50;
            ctx.fillStyle = shade(o.color, -26);
            ctx.beginPath();
            ctx.roundRect(roofX, oy + oh * 0.17, roofW, oh * 0.66, oh * 0.16);
            ctx.fill();

            /* ── glass ── */
            var glass = 'rgba(168,214,246,0.82)';
            // windscreen: angled strip at the front of the roof
            ctx.fillStyle = glass;
            ctx.beginPath();
            var wsX = dir > 0 ? roofX + roofW : roofX;
            ctx.moveTo(wsX, oy + oh * 0.20);
            ctx.lineTo(wsX + sgn * oh * 0.30, oy + oh * 0.31);
            ctx.lineTo(wsX + sgn * oh * 0.30, oy + oh * 0.69);
            ctx.lineTo(wsX, oy + oh * 0.80);
            ctx.closePath();
            ctx.fill();
            // rear window: shorter strip at the back of the roof
            ctx.fillStyle = 'rgba(150,196,230,0.70)';
            ctx.beginPath();
            var rwX = dir > 0 ? roofX : roofX + roofW;
            ctx.moveTo(rwX, oy + oh * 0.24);
            ctx.lineTo(rwX - sgn * oh * 0.20, oy + oh * 0.33);
            ctx.lineTo(rwX - sgn * oh * 0.20, oy + oh * 0.67);
            ctx.lineTo(rwX, oy + oh * 0.76);
            ctx.closePath();
            ctx.fill();
            // side window slits along the roof edges
            ctx.fillStyle = 'rgba(60,80,95,0.55)';
            ctx.fillRect(roofX + roofW * 0.16, oy + oh * 0.20, roofW * 0.66, oh * 0.09);
            ctx.fillRect(roofX + roofW * 0.16, oy + oh * 0.71, roofW * 0.66, oh * 0.09);

            /* ── roof highlight ── */
            ctx.fillStyle = 'rgba(255,255,255,0.13)';
            ctx.fillRect(roofX + roofW * 0.10, oy + oh * 0.33, roofW * 0.80, oh * 0.11);

            /* ── lights ── */
            // headlights
            ctx.fillStyle = '#fffde7';
            ctx.beginPath();
            ctx.ellipse(nose - sgn * oh * 0.16, oy + oh * 0.24, oh * 0.10, oh * 0.13, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(nose - sgn * oh * 0.16, oy + oh * 0.76, oh * 0.10, oh * 0.13, 0, 0, Math.PI * 2);
            ctx.fill();
            // taillights
            ctx.fillStyle = '#e53935';
            ctx.beginPath();
            ctx.roundRect(tail + (dir > 0 ? 1 : -oh * 0.20 - 1), oy + oh * 0.13, oh * 0.20, oh * 0.22, 1.5);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(tail + (dir > 0 ? 1 : -oh * 0.20 - 1), oy + oh * 0.65, oh * 0.20, oh * 0.22, 1.5);
            ctx.fill();

            /* ── mirrors ── */
            ctx.fillStyle = shade(o.color, -70);
            var mx = dir > 0 ? roofX + roofW * 0.94 : roofX + roofW * 0.06 - oh * 0.16;
            ctx.fillRect(mx, oy - oh * 0.09, oh * 0.16, oh * 0.10);
            ctx.fillRect(mx, oy + oh * 0.99, oh * 0.16, oh * 0.10);
        }
    }
}

var frogRidingX = null;

// Draw the frog shape at (cx, cy) with given radius
/* ── Frog model ──────────────────────────────────────────────────────────
 * Drawn top-down, facing -Y. Built as one continuous silhouette (snout →
 * cheeks → flanks → hips → rump) instead of stacked ellipses, with
 * articulated hind legs (hip → knee → ankle → webbed foot) that coil when
 * idle and extend through a hop.
 */

/* Webbed hind foot: a fan of toes joined by concave webbing. */
function drawWebbedFoot(ax, ay, ang, len, spread, toes, fill, edge) {
    var i, a, tipX, tipY, midA, midR;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (i = 0; i < toes; i++) {
        a = ang + (i / (toes - 1) - 0.5) * spread;
        tipX = ax + Math.cos(a) * len;
        tipY = ay + Math.sin(a) * len;
        if (i > 0) {
            // webbing dips between consecutive toe tips
            midA = ang + ((i - 0.5) / (toes - 1) - 0.5) * spread;
            midR = len * 0.66;
            ctx.quadraticCurveTo(ax + Math.cos(midA) * midR, ay + Math.sin(midA) * midR, tipX, tipY);
        } else {
            ctx.lineTo(tipX, tipY);
        }
    }
    ctx.closePath();
    ctx.fill();
    // toe bones
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(0.6, len * 0.10);
    ctx.lineCap = 'round';
    for (i = 0; i < toes; i++) {
        a = ang + (i / (toes - 1) - 0.5) * spread;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(a) * len * 0.94, ay + Math.sin(a) * len * 0.94);
        ctx.stroke();
    }
}

/* One hind leg. s = -1 left / +1 right, e = 0 coiled … 1 extended. */
function drawHindLeg(s, e, r, dark, mid, edge) {
    var hipX = s * r * 0.40, hipY = r * 0.28;
    // Frog hind legs are long. Coiled: knee juts far out and back beside the
    // rump with the shin folded in — the classic resting "Z". Extended:
    // hip→knee→ankle straighten out into a trailing kick.
    var kneeX = s * lerp(r * 0.70, r * 0.58, e);
    var kneeY = lerp(r * 0.54, r * 0.84, e);
    var ankX  = s * lerp(r * 0.42, r * 0.38, e);
    var ankY  = lerp(r * 0.88, r * 1.46, e);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // thigh
    ctx.strokeStyle = mid;
    ctx.lineWidth = r * 0.24;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();
    // shin
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.17;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(ankX, ankY);
    ctx.stroke();

    // foot points away from the knee
    var fa = Math.atan2(ankY - kneeY, ankX - kneeX);
    drawWebbedFoot(ankX, ankY, fa, r * lerp(0.30, 0.38, e), 1.05, 4, dark, edge);
}

/* One front leg: short, hugging the flank just behind the head. Planted
 * forward at rest, swept back through a hop. */
function drawFrontLeg(s, e, r, dark, edge) {
    var shX = s * r * 0.30, shY = -r * 0.36;
    var elX = s * lerp(r * 0.54, r * 0.44, e);
    var elY = lerp(-r * 0.16, r * 0.10, e);
    var haX = s * lerp(r * 0.52, r * 0.30, e);
    var haY = lerp(r * 0.18, r * 0.52, e);

    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elX, elY);
    ctx.lineTo(haX, haY);
    ctx.stroke();

    var ha = Math.atan2(haY - elY, haX - elX);
    drawWebbedFoot(haX, haY, ha, r * 0.21, 1.7, 4, dark, edge);
}

/* Continuous body + head outline, facing -Y: narrow snout, cheeks, a slight
 * waist behind the shoulders, then the hips as the widest point. */
function frogBodyPath(r) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.00);
    // right: snout → cheek
    ctx.bezierCurveTo( r * 0.15, -r * 0.99,  r * 0.34, -r * 0.84,  r * 0.39, -r * 0.58);
    // cheek → waist (pinched, so the head reads as a head)
    ctx.bezierCurveTo( r * 0.43, -r * 0.36,  r * 0.32, -r * 0.16,  r * 0.34,  r * 0.04);
    // waist → hip (widest point)
    ctx.bezierCurveTo( r * 0.38,  r * 0.30,  r * 0.64,  r * 0.34,  r * 0.62,  r * 0.60);
    // hip → rump
    ctx.bezierCurveTo( r * 0.60,  r * 0.86,  r * 0.34,  r * 0.96,  0,         r * 0.96);
    // mirror back up the left side
    ctx.bezierCurveTo(-r * 0.34,  r * 0.96, -r * 0.60,  r * 0.86, -r * 0.62,  r * 0.60);
    ctx.bezierCurveTo(-r * 0.64,  r * 0.34, -r * 0.38,  r * 0.30, -r * 0.34,  r * 0.04);
    ctx.bezierCurveTo(-r * 0.32, -r * 0.16, -r * 0.43, -r * 0.36, -r * 0.39, -r * 0.58);
    ctx.bezierCurveTo(-r * 0.34, -r * 0.84, -r * 0.15, -r * 0.99,  0,        -r * 1.00);
    ctx.closePath();
}

function drawFrogShape(cx, cy, r, moving, pose) {
    pose = pose || {};
    var e      = pose.ext    || 0;   // 0 coiled … 1 extended
    var squash = pose.squash || 0;   // landing compression
    var stretch= pose.stretch|| 0;   // take-off elongation

    var breathe = (moving && e < 0.02) ? Math.sin(frame * 0.05) * 0.018 : 0;

    var light = '#7cc45a';
    var mid   = '#4e9938';
    var dark  = '#2f6a24';
    var edge  = '#1d4716';

    ctx.save();
    ctx.translate(cx, cy);
    // squash & stretch along the travel axis (frog faces -Y)
    ctx.scale(1 + squash * 0.13 - stretch * 0.08 + breathe,
              1 - squash * 0.12 + stretch * 0.12 + breathe);

    /* ── hind legs, behind the body ── */
    drawHindLeg(-1, e, r, dark, mid, edge);
    drawHindLeg( 1, e, r, dark, mid, edge);

    /* ── body ── */
    var bodyGrad = ctx.createLinearGradient(-r * 0.5, -r * 0.9, r * 0.5, r * 0.9);
    bodyGrad.addColorStop(0, light);
    bodyGrad.addColorStop(0.45, mid);
    bodyGrad.addColorStop(1, dark);
    ctx.fillStyle = bodyGrad;
    frogBodyPath(r);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(0.7, r * 0.05);
    ctx.stroke();

    /* ── dorsal ridges ── */
    ctx.strokeStyle = 'rgba(24,60,16,0.32)';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, -r * 0.30);
    ctx.quadraticCurveTo(-r * 0.34, r * 0.20, -r * 0.20, r * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( r * 0.26, -r * 0.30);
    ctx.quadraticCurveTo( r * 0.34, r * 0.20,  r * 0.20, r * 0.62);
    ctx.stroke();

    /* ── back spots ── */
    ctx.fillStyle = 'rgba(22,58,14,0.38)';
    ctx.beginPath(); ctx.ellipse(-r * 0.30,  r * 0.18, r * 0.11, r * 0.08,  0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r * 0.30,  r * 0.18, r * 0.11, r * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 0,         r * 0.52, r * 0.13, r * 0.09,  0,   0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-r * 0.16, -r * 0.12, r * 0.08, r * 0.06,  0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( r * 0.16, -r * 0.12, r * 0.08, r * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();

    /* ── throat / chin highlight ── */
    ctx.fillStyle = 'rgba(200,240,175,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.19, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    /* ── front legs, over the body ── */
    drawFrontLeg(-1, e, r, dark, edge);
    drawFrontLeg( 1, e, r, dark, edge);

    /* ── eyes: domes sitting on the skull, only just proud of the outline ── */
    var eyeY = -r * 0.54, eyeX = r * 0.27, domeR = r * 0.185;
    var blinking = moving && (frame % 130 < 5);

    for (var s = -1; s <= 1; s += 2) {
        // dome in body colour so it reads as part of the head
        var domeGrad = ctx.createRadialGradient(s * eyeX - r * 0.06, eyeY - r * 0.08, r * 0.02,
                                                s * eyeX, eyeY, domeR);
        domeGrad.addColorStop(0, light);
        domeGrad.addColorStop(1, mid);
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.arc(s * eyeX, eyeY, domeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = Math.max(0.6, r * 0.045);
        ctx.stroke();

        if (blinking) {
            ctx.strokeStyle = edge;
            ctx.lineWidth = Math.max(1, r * 0.06);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(s * eyeX - r * 0.09, eyeY);
            ctx.lineTo(s * eyeX + r * 0.09, eyeY);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#fff8e1';
            ctx.beginPath();
            ctx.arc(s * eyeX, eyeY, r * 0.115, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f5a623';
            ctx.beginPath();
            ctx.arc(s * eyeX + r * 0.012, eyeY + r * 0.012, r * 0.075, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0d0d0d';
            ctx.beginPath();
            ctx.ellipse(s * eyeX + r * 0.012, eyeY + r * 0.012, r * 0.028, r * 0.060, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(s * eyeX - r * 0.04, eyeY - r * 0.045, r * 0.03, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ── nostrils & mouth ── */
    ctx.fillStyle = 'rgba(26,64,16,0.65)';
    ctx.beginPath(); ctx.arc(-r * 0.08, -r * 0.90, r * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.08, -r * 0.90, r * 0.03, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(26,64,16,0.55)';
    ctx.lineWidth = Math.max(0.8, r * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -r * 0.80, r * 0.17, 0.35, Math.PI - 0.35, false);
    ctx.stroke();

    ctx.restore();
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
    var hopLift = 0;      // 0 on the ground … 1 at the top of the arc
    var legExt  = 0;      // hind-leg extension driving the pose
    var stretch = 0;      // take-off elongation
    var shadowX = logX, shadowY = logY;

    if (frogHop && frogHop.t < frogHop.duration) {
        frogHop.t++;
        var p = frogHop.t / frogHop.duration;
        var eased = p * p * (3 - 2 * p); // smoothstep

        // Interpolate from saved start toward current logical position
        // (the "to" drifts naturally with log movement)
        frogCx = frogHop.fromX + (logX - frogHop.fromX) * eased;
        frogCy = frogHop.fromY + (logY - frogHop.fromY) * eased;

        // The shadow tracks the ground position, never the arc
        shadowX = frogCx;
        shadowY = frogHop.fromY + (logY - frogHop.fromY) * eased;

        // Parabolic arc — taller for vertical hops, shallower for sideways
        var dxHop = Math.abs(logX - frogHop.fromX);
        var dyHop = Math.abs(logY - frogHop.fromY);
        var arcH = dyHop > dxHop ? CELL * 0.55 : CELL * 0.38;
        hopLift = Math.sin(p * Math.PI);
        frogCy -= hopLift * arcH;

        // Legs snap out fast off the ground, then tuck in to land
        legExt = p < 0.28 ? (p / 0.28)
               : p < 0.72 ? 1
               : 1 - (p - 0.72) / 0.28;
        // Elongate on the way up, settle on the way down
        stretch = Math.max(0, 1 - p * 2.6);

        // Perspective: slightly smaller at the top of the arc
        frogR *= 1 - hopLift * 0.10;

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
        shadowX = frogCx;
        shadowY = frogCy;
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

    // Cast shadow on the ground: tightens and darkens as the frog rises,
    // which is what actually sells the height of the arc.
    ctx.save();
    ctx.globalAlpha = 0.30 * (1 - hopLift * 0.45);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY + CELL * 0.14 + hopLift * CELL * 0.10,
                CELL * 0.30 * (1 - hopLift * 0.34),
                CELL * 0.11 * (1 - hopLift * 0.34), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(frogCx, frogCy);
    ctx.rotate(frogAngle);
    drawFrogShape(0, 0, frogR, true, {
        ext: legExt,
        squash: landSquash / 8,
        stretch: stretch,
    });

    // Lengüetazo ocasional en reposo (en zonas seguras, mirando al frente)
    var safeRow = (frog.row === 5 || frog.row === 11);
    var tCyc = frame % 300;
    if (safeRow && !frogHop && tCyc < 16) {
        // Short flick starting AT the snout tip. Starting it further back drew
        // a pink stripe straight across the head.
        var tLen = Math.sin((tCyc / 16) * Math.PI) * frogR * 0.42;
        var tipY = -frogR * 0.98 - tLen;
        ctx.strokeStyle = '#e0637f';
        ctx.lineWidth = frogR * 0.11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -frogR * 0.96);
        ctx.lineTo(0, tipY);
        ctx.stroke();
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath();
        ctx.ellipse(0, tipY, frogR * 0.11, frogR * 0.085, 0, 0, Math.PI * 2);
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
        /* save/restore por partícula empujaba y sacaba TODO el estado del
           contexto; aquí solo cambian globalAlpha y fillStyle, y ambos se
           reasignan en cada vuelta. Basta con reponer el alpha al salir. */
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

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
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ccc';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function updateAndDrawJumpParticles() {
    for (var i = jumpParticles.length - 1; i >= 0; i--) {
        var p = jumpParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        if (p.life <= 0) { jumpParticles.splice(i, 1); continue; }
        var a = p.life / p.maxLife;
        ctx.globalAlpha = a * 0.75;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    if (score > highScore) { highScore = score; GameStore.set('froggerHigh', highScore); }
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

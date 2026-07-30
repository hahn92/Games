// Whack-a-Mole
const TOTAL_HOLES = 9;
const GAME_DURATION = 60;

// Mole types
const MOLE_NORMAL = 'normal';
const MOLE_GOLDEN = 'golden'; // 15% chance, worth 3 pts
const MOLE_EVIL   = 'evil';   // 10% chance, -1 pt

let score = 0;
let highScore = parseInt(localStorage.getItem('whackHighScore') || '0', 10);
let timeLeft = GAME_DURATION;
let isPlaying = false;
let moleInterval = null;
let timerInterval = null;
let holeTimeouts = [];

// Track mole type per hole
const holeTypes = [];
const holes = [];

/* ---- Build mole DOM (CSS-only, no emoji) ---- */
function createMoleDom() {
    const mole = document.createElement('div');
    mole.classList.add('mole');

    const body = document.createElement('div');
    body.classList.add('mole-body');

    const eyeL = document.createElement('div');
    eyeL.classList.add('mole-eye-left');
    const eyeR = document.createElement('div');
    eyeR.classList.add('mole-eye-right');

    body.appendChild(eyeL);
    body.appendChild(eyeR);
    mole.appendChild(body);
    return mole;
}

/* ---- Build time bar ---- */
function buildTimerBar() {
    // Inject time bar above score-panel if not already present
    const infoSide = document.querySelector('.info-side');
    if (!infoSide) return;
    if (document.getElementById('timeBarWrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'time-bar-wrap';
    wrap.id = 'timeBarWrap';
    const bar = document.createElement('div');
    bar.className = 'time-bar';
    bar.id = 'timeBar';
    wrap.appendChild(bar);

    // Insert before score-panel
    const scorePanel = infoSide.querySelector('.score-panel');
    if (scorePanel) {
        infoSide.insertBefore(wrap, scorePanel);
    } else {
        infoSide.appendChild(wrap);
    }

    // Speed label
    if (!document.getElementById('speedLabel')) {
        const lbl = document.createElement('div');
        lbl.className = 'speed-label';
        lbl.id = 'speedLabel';
        infoSide.insertBefore(lbl, document.querySelector('.buttons-panel'));
    }
}

function updateTimeBar() {
    const bar = document.getElementById('timeBar');
    if (bar) {
        const pct = (timeLeft / GAME_DURATION) * 100;
        bar.style.width = pct + '%';
        // Color shift: green -> orange -> red
        if (pct > 50) {
            bar.style.background = 'linear-gradient(90deg, #8fd3f4 0%, #4caf2a 100%)';
        } else if (pct > 25) {
            bar.style.background = 'linear-gradient(90deg, #ffd600 0%, #ff8c00 100%)';
        } else {
            bar.style.background = 'linear-gradient(90deg, #ff512f 0%, #dd2476 100%)';
        }
    }
}

/* ---- Grid init ---- */
function initGrid() {
    const grid = document.getElementById('moleGrid');
    grid.innerHTML = '';
    holes.length = 0;
    holeTypes.length = 0;

    for (let i = 0; i < TOTAL_HOLES; i++) {
        const hole = document.createElement('div');
        hole.classList.add('hole');

        const mole = createMoleDom();
        hole.appendChild(mole);

        hole.addEventListener('click', function() { whack(i); });
        hole.addEventListener('touchstart', function(e) {
            e.preventDefault();
            whack(i);
        }, { passive: false });

        grid.appendChild(hole);
        holes.push(hole);
        holeTypes.push(MOLE_NORMAL);
    }
}

/* ---- Determine mole type ---- */
function pickMoleType() {
    const r = Math.random();
    if (r < 0.10) return MOLE_EVIL;
    if (r < 0.25) return MOLE_GOLDEN; // 10-25% => golden
    return MOLE_NORMAL;
}

/* ---- Progressive difficulty ---- */
function getShowDuration() {
    // Starts at 1400ms, shrinks to ~500ms over 60s
    const elapsed = GAME_DURATION - timeLeft;
    const duration = Math.max(500, 1400 - elapsed * 15);
    return duration;
}

function getMoleInterval() {
    // Interval between pops: starts at 900ms, goes to 450ms
    const elapsed = GAME_DURATION - timeLeft;
    return Math.max(450, 900 - elapsed * 7);
}

function updateSpeedLabel() {
    const lbl = document.getElementById('speedLabel');
    if (!lbl) return;
    const elapsed = GAME_DURATION - timeLeft;
    let mode;
    if (elapsed < 15) mode = 'Velocidad: Normal';
    else if (elapsed < 35) mode = 'Velocidad: Rapido';
    else mode = 'Velocidad: Frenético';
    lbl.textContent = mode;
}

/* ---- Pop a mole ---- */
function popMole() {
    if (!isPlaying) return;

    const inactive = holes.map((h, i) => i).filter(i => !holes[i].classList.contains('active'));
    if (inactive.length === 0) return;

    const idx = inactive[Math.floor(Math.random() * inactive.length)];
    const hole = holes[idx];
    const type = pickMoleType();
    holeTypes[idx] = type;

    // Apply type class to mole element
    const mole = hole.querySelector('.mole');
    mole.classList.remove('golden', 'evil');
    if (type === MOLE_GOLDEN) mole.classList.add('golden');
    if (type === MOLE_EVIL)   mole.classList.add('evil');

    hole.classList.add('active');

    const duration = getShowDuration();
    const t = setTimeout(function() {
        if (hole.classList.contains('active')) {
            GameAudio.miss();
        }
        hole.classList.remove('active');
        holeTypes[idx] = MOLE_NORMAL;
    }, duration);
    holeTimeouts.push(t);

    // Update mole interval dynamically
    clearInterval(moleInterval);
    moleInterval = setInterval(popMole, getMoleInterval());
}

/* ---- Hit effect floating label ---- */
function showHitEffect(hole, text, color) {
    const eff = document.createElement('div');
    eff.className = 'hit-effect';
    eff.textContent = text;
    eff.style.color = color || '#fff';
    eff.style.left = '50%';
    eff.style.bottom = '60%';
    eff.style.transform = 'translateX(-50%)';
    hole.appendChild(eff);
    setTimeout(function() { eff.remove(); }, 700);
}

/* ---- Whack ---- */
function whack(i) {
    if (!isPlaying) return;
    const hole = holes[i];
    if (!hole.classList.contains('active')) return;

    const type = holeTypes[i];
    hole.classList.remove('active');
    holeTypes[i] = MOLE_NORMAL;

    if (type === MOLE_EVIL) {
        score = Math.max(0, score - 1);
        hole.classList.add('whacked');
        showHitEffect(hole, '-1', '#ff4444');
    } else if (type === MOLE_GOLDEN) {
        score += 3;
        hole.classList.add('whacked');
        showHitEffect(hole, '+3', '#ffd700');
    } else {
        score++;
        hole.classList.add('whacked');
        showHitEffect(hole, '+1', '#8fd3f4');
    }
    GameAudio.whack();

    setTimeout(function() { hole.classList.remove('whacked'); }, 300);
    updateScore();
}

/* ---- Score with bump animation ---- */
function updateScore() {
    const scoreEl = document.getElementById('score');
    scoreEl.textContent = score;

    // Bump animation
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth; // force reflow
    scoreEl.classList.add('bump');
    setTimeout(function() { scoreEl.classList.remove('bump'); }, 200);

    document.getElementById('mobileScore').textContent = 'Puntaje: ' + score + ' | Tiempo: ' + timeLeft + 's';

    if (score > highScore) {
        highScore = score;
        try { localStorage.setItem('whackHighScore', highScore); } catch (e) {}
    }
    document.getElementById('highScore').textContent = highScore;
}

function updateTimer() {
    document.getElementById('timer').textContent = timeLeft;
    document.getElementById('mobileScore').textContent = 'Puntaje: ' + score + ' | Tiempo: ' + timeLeft + 's';
    updateTimeBar();
    updateSpeedLabel();
}

/* ---- Game flow ---- */
function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    isPlaying = true;
    GameAudio.start();

    holeTimeouts.forEach(t => clearTimeout(t));
    holeTimeouts = [];

    holes.forEach(function(h, i) {
        h.classList.remove('active', 'whacked');
        holeTypes[i] = MOLE_NORMAL;
        const mole = h.querySelector('.mole');
        if (mole) mole.classList.remove('golden', 'evil');
    });

    clearInterval(moleInterval);
    clearInterval(timerInterval);

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    updateScore();
    updateTimer();

    moleInterval = setInterval(popMole, getMoleInterval());

    timerInterval = setInterval(function() {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
            gameOver();
        }
    }, 1000);
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    clearInterval(moleInterval);
    clearInterval(timerInterval);
    holeTimeouts.forEach(t => clearTimeout(t));
    holeTimeouts = [];

    holes.forEach(h => h.classList.remove('active', 'whacked'));

    const popup = document.getElementById('gameOverPopup');
    const finalEl = document.getElementById('finalScore');
    const newRecord = score >= highScore && score > 0;
    finalEl.innerHTML = 'Puntaje: ' + score +
        (newRecord ? '<br><span style="color:#ffd700;font-size:1rem;">Nuevo record!</span>' : '') +
        '<br><span style="font-size:1rem;color:#8fd3f4;">Mejor: ' + highScore + '</span>';

    popup.style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    if (document.getElementById('mobileStartBtn')) {
        document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

/* ---- Wire buttons ---- */
document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

/* ---- Wrap score span for animation ---- */
function wrapScoreSpan() {
    const el = document.getElementById('score');
    if (el) el.classList.add('score-animated');
    const hs = document.getElementById('highScore');
    if (hs) hs.classList.add('score-animated');
}

/* ---- Init ---- */
function init() {
    buildTimerBar();
    initGrid();
    wrapScoreSpan();
    document.getElementById('score').textContent = '0';
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('timer').textContent = GAME_DURATION;
    updateTimeBar();
    const lbl = document.getElementById('speedLabel');
    if (lbl) lbl.textContent = '';
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') {
    init();
}

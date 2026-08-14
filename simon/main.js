// Simon Says
const COLORS = ['red', 'blue', 'green', 'yellow'];

// Musical note labels per color (visual only, no audio)
const COLOR_NOTES = {
    red:    'Mi',
    blue:   'Sol',
    green:  'Do',
    yellow: 'Re'
};

// Glow colors for status messages
const COLOR_HEX = {
    red:    '#ff5252',
    blue:   '#2979ff',
    green:  '#00e676',
    yellow: '#ffd740'
};

let sequence = [];
let playerSeq = [];
let round = 0;
let score = 0;
let highScore = GameStore.getNum('simonHighScore', 0);
let isPlaying = false;
let isFlashing = false;
let playerTurn = false;

/* ---- Add note labels to buttons ---- */
function initNoteLabels() {
    COLORS.forEach(function(color) {
        const btn = document.getElementById('btn-' + color);
        if (!btn.querySelector('.btn-note')) {
            const note = document.createElement('span');
            note.className = 'btn-note';
            note.textContent = COLOR_NOTES[color];
            btn.appendChild(note);
        }
    });
}

/* ---- Add speed mode label below score panel ---- */
function initSpeedMode() {
    const infoSide = document.querySelector('.info-side');
    if (!infoSide || document.getElementById('speedMode')) return;
    const lbl = document.createElement('div');
    lbl.className = 'speed-mode';
    lbl.id = 'speedMode';
    const scorePanel = infoSide.querySelector('.score-panel');
    if (scorePanel) {
        infoSide.insertBefore(lbl, scorePanel.nextSibling);
    } else {
        infoSide.appendChild(lbl);
    }
}

function updateSpeedMode() {
    const lbl = document.getElementById('speedMode');
    if (!lbl) return;
    if (round <= 5)       lbl.textContent = 'Modo: Normal';
    else if (round <= 10) lbl.textContent = 'Modo: Rapido';
    else                  lbl.textContent = 'Modo: Experto';
}

/* ---- Flash timings by level ---- */
function getFlashDuration() {
    if (round <= 5)  return 520;
    if (round <= 10) return 360;
    return 240;
}

function getFlashGap() {
    if (round <= 5)  return 220;
    if (round <= 10) return 160;
    return 100;
}

/* ---- Status ---- */
function setStatus(msg, isError) {
    const el = document.getElementById('status');
    el.textContent = msg;
    if (isError) {
        el.classList.add('error');
    } else {
        el.classList.remove('error');
    }
}

/* ---- Score update with bump ---- */
var gameHud = GU.hud({
    score: 'score',
    round: 'level',
    mobile: { el: 'mobileScore', format: function () {
        return 'Ronda: ' + round + ' | Puntaje: ' + score;
    } }
});

function updateScore() {
    const scoreEl = document.getElementById('score');
    scoreEl.textContent = score;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
    setTimeout(function() { scoreEl.classList.remove('bump'); }, 200);

    gameHud.set({ round: round, score: score });

    if (score > highScore) {
        highScore = score;
        GameStore.set('simonHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;

    updateSpeedMode();
}

/* ---- Level badge animation ---- */
function showLevelBadge() {
    const levelEl = document.getElementById('level');
    // Remove existing badge if any
    const existing = levelEl.parentElement.querySelector('.level-badge');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.className = 'level-badge';
    badge.textContent = 'Nivel ' + round;
    levelEl.parentElement.appendChild(badge);

    setTimeout(function() {
        badge.remove();
    }, 1800);
}

/* ---- Flash a single button ---- */
function flash(color, duration) {
    return new Promise(function(resolve) {
        var btn = document.getElementById('btn-' + color);
        btn.classList.add('lit');
        setTimeout(function() {
            btn.classList.remove('lit');
            resolve();
        }, duration);
    });
}

function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/* ---- Flash the full sequence ---- */
async function flashSequence() {
    isFlashing = true;
    playerTurn = false;
    setStatus('Observa...', false);
    setBtnsEnabled(false);

    await delay(500);

    const flashDur = getFlashDuration();
    const flashGap = getFlashGap();

    for (var i = 0; i < sequence.length; i++) {
        GameAudio.simon(COLORS.indexOf(sequence[i]));
        await flash(sequence[i], flashDur);
        await delay(flashGap);
    }

    isFlashing = false;
    playerTurn = true;
    setBtnsEnabled(true);
    setStatus('Tu turno!', false);
}

function setBtnsEnabled(enabled) {
    COLORS.forEach(function(color) {
        var btn = document.getElementById('btn-' + color);
        btn.disabled = !enabled;
    });
}

function addToSequence() {
    var color = COLORS[Math.floor(Math.random() * COLORS.length)];
    sequence.push(color);
    round = sequence.length;
    updateScore();
    showLevelBadge();
    flashSequence();
}

/* ---- Pressed animation (player input) ---- */
function pressBtn(color) {
    return new Promise(function(resolve) {
        var btn = document.getElementById('btn-' + color);
        btn.classList.add('pressed');
        setTimeout(function() {
            btn.classList.remove('pressed');
            resolve();
        }, 200);
    });
}

/* ---- Fail animation: shake board + flash all buttons red ---- */
async function playFailAnimation() {
    const board = document.getElementById('simonBoard');
    board.classList.add('fail-shake');

    COLORS.forEach(function(color) {
        var btn = document.getElementById('btn-' + color);
        btn.classList.add('fail-flash');
    });

    await delay(800);

    board.classList.remove('fail-shake');
    COLORS.forEach(function(color) {
        var btn = document.getElementById('btn-' + color);
        btn.classList.remove('fail-flash');
    });
}

/* ---- Handle player input ---- */
async function handleInput(color) {
    if (!isPlaying || !playerTurn || isFlashing) return;

    playerSeq.push(color);
    var idx = playerSeq.length - 1;
    GameAudio.simon(COLORS.indexOf(color));

    // Press visual feedback
    await pressBtn(color);

    // Check correctness
    if (playerSeq[idx] !== sequence[idx]) {
        playerTurn = false;
        setBtnsEnabled(false);
        GameAudio.noMatch();
        await playFailAnimation();
        setStatus('Error! Llegaste al nivel ' + round, true);
        await delay(700);
        gameOver();
        return;
    }

    // Full sequence completed
    if (playerSeq.length === sequence.length) {
        score += round;
        updateScore();
        GameAudio.score();
        playerSeq = [];
        playerTurn = false;
        setBtnsEnabled(false);
        setStatus('Correcto! Siguiente ronda...', false);
        await delay(1000);
        addToSequence();
    }
}

/* ---- Game flow ---- */
function startGame() {
    GameAudio.start();
    sequence = [];
    playerSeq = [];
    round = 0;
    score = 0;
    isPlaying = true;
    isFlashing = false;
    playerTurn = false;

    document.getElementById('gameOverPopup').style.display = 'none';
    gameControls.running();

    // Reset buttons visual state
    COLORS.forEach(function(color) {
        var btn = document.getElementById('btn-' + color);
        btn.classList.remove('lit', 'pressed', 'fail-flash');
    });
    document.getElementById('simonBoard').classList.remove('fail-shake');

    updateScore();
    setStatus('', false);

    setTimeout(function() { addToSequence(); }, 500);
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    playerTurn = false;
    GameAudio.gameOver();
    setBtnsEnabled(false);
    setStatus('', false);

    const newRecord = score >= highScore && score > 0;
    const finalEl = document.getElementById('finalScore');
    finalEl.innerHTML = 'Puntaje: ' + score +
        (newRecord ? '<br><span style="color:#ffd700;font-size:1rem;">Nuevo record!</span>' : '') +
        '<br><span style="font-size:1rem;color:#8fd3f4;">Mejor: ' + highScore + ' | Nivel max: ' + round + '</span>';

    document.getElementById('gameOverPopup').style.display = 'flex';
    gameControls.idle();

    if (document.getElementById('mobileStartBtn')) {
        document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

/* ---- Wire up buttons ---- */
COLORS.forEach(function(color) {
    var btn = document.getElementById('btn-' + color);

    btn.addEventListener('click', function() { handleInput(color); });
    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleInput(color);
    }, { passive: false });
});

var gameControls = GU.controls({ start: startGame, restart: restartGame, playAgain: startGame, popup: 'gameOverPopup' });

/* ---- Init ---- */
function init() {
    initNoteLabels();
    initSpeedMode();

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.classList.add('score-animated');

    gameHud.set({ score: 0, round: 0 });
    document.getElementById('highScore').textContent = highScore;
    setBtnsEnabled(false);
    updateSpeedMode();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') {
    init();
}

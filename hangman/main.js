/* =====================================================
   AHORCADO — main.js
   ===================================================== */

'use strict';

// ─── WORD DATABASE ────────────────────────────────────
const WORDS = {
    'Animales': [
        'ELEFANTE', 'JIRAFAS', 'COCODRILO', 'MARIPOSA', 'LEOPARDO',
        'PINGUINO', 'MURCIELAGO', 'CANGURO', 'DELFIN', 'TORTUGA',
        'FLAMENCO', 'RINOCERONTE', 'ORANGUTAN', 'SALAMANDRA', 'ARMADILLO',
        'HIPOPOTAMO'
    ],
    'Países': [
        'ALEMANIA', 'ARGENTINA', 'AUSTRALIA', 'BRASIL', 'COLOMBIA',
        'ETIOPIA', 'FINLANDIA', 'GRECIA', 'HUNGRIA', 'INDONESIA',
        'JAPON', 'KENIA', 'LUXEMBURGO', 'MARRUECOS', 'NIGERIA',
        'PORTUGAL'
    ],
    'Deportes': [
        'BALONCESTO', 'NATACION', 'CICLISMO', 'ATLETISMO', 'ESGRIMA',
        'GIMNASIA', 'VOLEIBOL', 'BALONMANO', 'WATERPOLO', 'TAEKWONDO',
        'ESCALADA', 'TRIATLON', 'REMO', 'HOCKEY', 'RUGBY', 'SURF'
    ]
};

const SPANISH_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const MAX_WRONG = 6;
const PTS_CORRECT = 10;
const PTS_BONUS = 50;

// ─── STATE ────────────────────────────────────────────
let state = {
    word: '',
    category: 'Animales',
    guessed: new Set(),
    wrong: 0,
    wrongLetters: [],
    score: 0,
    highScore: parseInt(localStorage.getItem('hangman_highscore') || '0', 10),
    gameActive: false,
    gameOver: false
};

// ─── DOM REFS ─────────────────────────────────────────
const canvas        = document.getElementById('hangmanCanvas');
const ctx           = canvas.getContext('2d');
const wordDisplay   = document.getElementById('wordDisplay');
const wrongList     = document.getElementById('wrongLettersList');
const keyboardEl    = document.getElementById('keyboard');
const scoreEl       = document.getElementById('score');
const highScoreEl   = document.getElementById('highScore');
const mScoreEl      = document.getElementById('mScore');
const mHighScoreEl  = document.getElementById('mHighScore');
const currentCatEl  = document.getElementById('currentCategory');
const startBtn      = document.getElementById('startBtn');
const restartBtn    = document.getElementById('restartBtn');
const resultOverlay = document.getElementById('resultOverlay');
const resultTitle   = document.getElementById('resultTitle');
const resultWord    = document.getElementById('resultWord');
const resultStats   = document.getElementById('resultStats');
const playAgainBtn  = document.getElementById('playAgainBtn');
const catButtons        = document.querySelectorAll('#categoryButtons .cat-btn');
const resultCatButtons  = document.querySelectorAll('#resultCategoryButtons .cat-btn');

// ─── CANVAS DRAWING ───────────────────────────────────

function drawGallows() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = '#8fd3f4';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base horizontal
    ctx.beginPath();
    ctx.moveTo(20, H - 20);
    ctx.lineTo(W - 20, H - 20);
    ctx.stroke();

    // Vertical pole
    ctx.beginPath();
    ctx.moveTo(60, H - 20);
    ctx.lineTo(60, 20);
    ctx.stroke();

    // Horizontal beam
    ctx.beginPath();
    ctx.moveTo(60, 20);
    ctx.lineTo(190, 20);
    ctx.stroke();

    // Short diagonal brace
    ctx.beginPath();
    ctx.moveTo(60, 60);
    ctx.lineTo(100, 20);
    ctx.stroke();

    // Rope
    ctx.beginPath();
    ctx.moveTo(190, 20);
    ctx.lineTo(190, 60);
    ctx.stroke();

    ctx.restore();
}

function drawBodyParts(wrongCount) {
    ctx.save();
    ctx.strokeStyle = '#ff512f';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Head
    if (wrongCount >= 1) {
        ctx.beginPath();
        ctx.arc(190, 82, 22, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Body
    if (wrongCount >= 2) {
        ctx.beginPath();
        ctx.moveTo(190, 104);
        ctx.lineTo(190, 185);
        ctx.stroke();
    }

    // Left arm
    if (wrongCount >= 3) {
        ctx.beginPath();
        ctx.moveTo(190, 120);
        ctx.lineTo(155, 155);
        ctx.stroke();
    }

    // Right arm
    if (wrongCount >= 4) {
        ctx.beginPath();
        ctx.moveTo(190, 120);
        ctx.lineTo(225, 155);
        ctx.stroke();
    }

    // Left leg
    if (wrongCount >= 5) {
        ctx.beginPath();
        ctx.moveTo(190, 185);
        ctx.lineTo(155, 235);
        ctx.stroke();
    }

    // Right leg
    if (wrongCount >= 6) {
        ctx.beginPath();
        ctx.moveTo(190, 185);
        ctx.lineTo(225, 235);
        ctx.stroke();
    }

    ctx.restore();
}

function renderCanvas() {
    drawGallows();
    drawBodyParts(state.wrong);
}

// ─── WORD DISPLAY ─────────────────────────────────────

function renderWord() {
    wordDisplay.innerHTML = '';
    for (const letter of state.word) {
        const slot = document.createElement('div');
        slot.className = 'letter-slot';

        const charEl = document.createElement('div');
        charEl.className = 'letter-char';

        if (state.guessed.has(letter)) {
            charEl.textContent = letter;
            charEl.classList.add('revealed');
        } else if (state.gameOver && !isWon()) {
            // Reveal on lose
            charEl.textContent = letter;
            charEl.style.color = '#ff7043';
        } else {
            charEl.textContent = '';
        }

        const underline = document.createElement('div');
        underline.className = 'letter-underline';

        slot.appendChild(charEl);
        slot.appendChild(underline);
        wordDisplay.appendChild(slot);
    }
}

// ─── KEYBOARD ─────────────────────────────────────────

function buildKeyboard() {
    keyboardEl.innerHTML = '';
    for (const letter of SPANISH_ALPHABET) {
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        btn.textContent = letter;
        btn.dataset.letter = letter;
        btn.setAttribute('aria-label', 'Letra ' + letter);

        btn.addEventListener('click', () => handleGuess(letter));
        keyboardEl.appendChild(btn);
    }
}

function updateKeyboard() {
    for (const btn of keyboardEl.querySelectorAll('.key-btn')) {
        const letter = btn.dataset.letter;
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;

        if (state.guessed.has(letter)) {
            if (state.word.includes(letter)) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('wrong');
            }
            btn.disabled = true;
        }

        if (!state.gameActive || state.gameOver) {
            btn.disabled = true;
        }
    }
}

// ─── SCORE ────────────────────────────────────────────

function updateScoreDisplay() {
    scoreEl.textContent = state.score;
    highScoreEl.textContent = state.highScore;
    if (mScoreEl)   mScoreEl.textContent   = state.score;
    if (mHighScoreEl) mHighScoreEl.textContent = state.highScore;
}

function bumpScore(delta) {
    state.score += delta;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        try { localStorage.setItem('hangman_highscore', state.highScore); } catch (e) {}
    }
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth; // reflow to restart animation
    scoreEl.classList.add('bump');
    setTimeout(() => scoreEl.classList.remove('bump'), 250);
    updateScoreDisplay();
}

// ─── GAME LOGIC ───────────────────────────────────────

function isWon() {
    return [...state.word].every(l => state.guessed.has(l));
}

function handleGuess(letter) {
    if (!state.gameActive || state.gameOver) return;
    if (state.guessed.has(letter)) return;

    state.guessed.add(letter);

    if (state.word.includes(letter)) {
        // Correct guess
        GameAudio.correct();
        bumpScore(PTS_CORRECT);
    } else {
        // Wrong guess
        state.wrong++;
        state.wrongLetters.push(letter);
        GameAudio.absent();
        renderCanvas();
        // Shake the canvas to indicate wrong guess
        canvas.classList.remove('shake');
        void canvas.offsetWidth;
        canvas.classList.add('shake');
        setTimeout(() => canvas.classList.remove('shake'), 350);
    }

    updateKeyboard();
    renderWord();
    updateWrongLettersList();
    checkEndCondition();
}

function updateWrongLettersList() {
    if (state.wrongLetters.length === 0) {
        wrongList.innerHTML = '&nbsp;';
    } else {
        wrongList.textContent = state.wrongLetters.join('  ');
    }
}

function checkEndCondition() {
    if (isWon()) {
        state.gameOver = true;
        state.gameActive = false;
        let bonus = 0;
        if (state.wrong <= 2) {
            bonus = PTS_BONUS;
            bumpScore(bonus);
        }
        GameAudio.win();
        setTimeout(() => showResult(true, bonus), 500);
    } else if (state.wrong >= MAX_WRONG) {
        state.gameOver = true;
        state.gameActive = false;
        renderWord(); // reveal word
        GameAudio.gameOver();
        setTimeout(() => showResult(false, 0), 600);
    }
}

function showResult(won, bonus) {
    resultTitle.textContent = won ? '¡Ganaste!' : '¡Perdiste!';
    resultTitle.className = won ? 'win' : 'lose';
    resultWord.textContent = state.word;

    let statsHtml = `Errores: <b>${state.wrong}</b> de ${MAX_WRONG}<br>`;
    if (won) {
        statsHtml += `Letras correctas: <b>${[...state.guessed].filter(l => state.word.includes(l)).length}</b><br>`;
        if (bonus > 0) {
            statsHtml += `<span style="color:#ffd700">+${bonus} pts bonus por pocos errores!</span><br>`;
        }
    }
    statsHtml += `Puntaje: <b>${state.score}</b>`;
    resultStats.innerHTML = statsHtml;

    // Sync result category buttons with current category
    resultCatButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === state.category);
    });

    resultOverlay.style.display = 'flex';
    restartBtn.disabled = false;

    // Re-show mobile start button so mobile users can restart
    const mobileStartBtn = document.getElementById('mobileStartBtn');
    if (mobileStartBtn && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        mobileStartBtn.style.display = 'none'; // overlay handles it
    }
}

function hideResult() {
    resultOverlay.style.display = 'none';
}

// ─── GAME INIT / RESTART ──────────────────────────────

function pickWord(category) {
    const list = WORDS[category];
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
}

function startGame() {
    const word = pickWord(state.category);
    state.word         = word;
    state.guessed      = new Set();
    state.wrong        = 0;
    state.wrongLetters = [];
    state.gameActive   = true;
    state.gameOver     = false;

    currentCatEl.textContent = state.category;
    hideResult();
    renderCanvas();
    renderWord();
    updateWrongLettersList();
    buildKeyboard();
    updateKeyboard();
    updateScoreDisplay();
    restartBtn.disabled = false;

    // Lock category buttons during game
    catButtons.forEach(btn => btn.disabled = true);

    GameAudio.start();
}

function resetScoreAndStart() {
    state.score = 0;
    updateScoreDisplay();
    startGame();
}

// ─── KEYBOARD INPUT (physical keyboard) ───────────────

document.addEventListener('keydown', (e) => {
    if (!state.gameActive || state.gameOver) return;
    const key = e.key.toUpperCase();
    if (SPANISH_ALPHABET.includes(key)) {
        handleGuess(key);
    }
});

// ─── CATEGORY SELECTION ───────────────────────────────

catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.category = btn.dataset.category;
        GameAudio.click();
    });
});

resultCatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        resultCatButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Also sync the sidebar category buttons
        catButtons.forEach(b => b.classList.toggle('active', b.dataset.category === btn.dataset.category));
        state.category = btn.dataset.category;
        GameAudio.click();
    });
});

// ─── BUTTON HANDLERS ──────────────────────────────────

startBtn.addEventListener('click', () => {
    catButtons.forEach(btn => btn.disabled = false);
    resetScoreAndStart();
});

restartBtn.addEventListener('click', () => {
    startGame();
});

playAgainBtn.addEventListener('click', () => {
    GameAudio.click();
    catButtons.forEach(btn => btn.disabled = false);
    hideResult();
    startGame();
});

// ─── INIT ─────────────────────────────────────────────

(function init() {
    // Restore high score
    highScoreEl.textContent = state.highScore;
    if (mHighScoreEl) mHighScoreEl.textContent = state.highScore;
    scoreEl.textContent = 0;

    // Draw empty gallows
    drawGallows();

    // Build keyboard (disabled until game starts)
    buildKeyboard();
    updateKeyboard();

    // Show mobile start button if needed
    const mobileStartBtn = document.getElementById('mobileStartBtn');
    if (mobileStartBtn) {
        const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMob) mobileStartBtn.style.display = 'block';
    }
})();

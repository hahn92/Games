// =====================================================================
//  MEMORAMA — main.js
//  Mejoras: flip 3D, match/mismatch animations, dificultad, timer, stats
// =====================================================================

// --- Dificultad ---
// easy:   4×3 = 12 cartas (6 parejas)
// normal: 4×4 = 16 cartas (8 parejas)  ← default
// hard:   6×4 = 24 cartas (12 parejas)
const DIFFICULTY_CONFIG = {
    easy:   { cols: 4, rows: 3, totalCards: 12 },
    normal: { cols: 4, rows: 4, totalCards: 16 },
    hard:   { cols: 6, rows: 4, totalCards: 24 }
};

let currentDifficulty = 'normal';
let board = [], flipped = [], matchedCount = 0;
let score = 500, highScore = GameStore.getNum('memoramaHighScore', 0);
let isPlaying = false;
let timerInterval = null, elapsedSeconds = 0, timerStarted = false;

// Best times per difficulty, stored as seconds (lower = better)
function getBestTime(diff) {
    const v = GameStore.get('memoramaBestTime_' + diff, null);
    return v ? parseInt(v, 10) : null;
}
function setBestTime(diff, seconds) {
    GameStore.set('memoramaBestTime_' + diff, seconds);
}

// ---- Shuffle ----
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---- Board creation ----
function createBoard() {
    const cfg = DIFFICULTY_CONFIG[currentDifficulty];
    const pairs = cfg.totalCards / 2;
    let values = [];
    for (let i = 1; i <= pairs; i++) {
        values.push(i, i);
    }
    values = shuffle(values);

    board = [];
    for (let r = 0; r < cfg.rows; r++) {
        board[r] = [];
        for (let c = 0; c < cfg.cols; c++) {
            board[r][c] = { value: values.pop(), flipped: false, matched: false };
        }
    }

    flipped = [];
    matchedCount = 0;
    score = 500;
    elapsedSeconds = 0;
    timerStarted = false;

    updateBoardGrid();
    render();
    updateStats();
}

// Set CSS grid on the board container according to difficulty
function updateBoardGrid() {
    const cfg = DIFFICULTY_CONFIG[currentDifficulty];
    const container = document.getElementById('memoramaBoard');
    container.dataset.cols = cfg.cols;
    container.dataset.rows = cfg.rows;
    container.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', 1fr)';
    container.style.gridTemplateRows = 'repeat(' + cfg.rows + ', 1fr)';
}

// ---- Render ----
function render() {
    const cfg = DIFFICULTY_CONFIG[currentDifficulty];
    const container = document.getElementById('memoramaBoard');
    container.innerHTML = '';

    for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
            // El render inicial ocurre antes de repartir (board sigue vacío):
            // sin este respaldo, board[r][c] lanzaba un TypeError al cargar la
            // página y dejaba la rejilla sin pintar.
            const cardData = (board[r] && board[r][c]) || { value: '', flipped: false, matched: false };

            const card = document.createElement('div');
            card.className = 'card';
            if (cardData.flipped || cardData.matched) card.classList.add('flipped');
            if (cardData.matched) card.classList.add('matched');

            const front = document.createElement('div');
            front.className = 'card-front';

            const back = document.createElement('div');
            back.className = 'card-back';
            back.textContent = cardData.value;

            card.appendChild(front);
            card.appendChild(back);

            if (!cardData.matched) {
                card.addEventListener('click', () => flipCard(r, c));
            }
            container.appendChild(card);
        }
    }
}

// ---- Flip card ----
function flipCard(r, c) {
    if (!isPlaying) return;
    const card = board[r][c];
    if (card.flipped || card.matched || flipped.length === 2) return;

    // Start timer on first flip
    if (!timerStarted) {
        timerStarted = true;
        startTimer();
    }

    card.flipped = true;
    flipped.push({ r, c });
    GameAudio.flip();
    // Count an attempt every time the second card is flipped
    if (flipped.length === 2) attempts++;
    render();
    updateStats();

    if (flipped.length === 2) {
        setTimeout(checkMatch, 700);
    }
}

// ---- DOM helpers: get card element at grid position ----
function getCardElement(r, c) {
    const cfg = DIFFICULTY_CONFIG[currentDifficulty];
    const idx = r * cfg.cols + c;
    return document.getElementById('memoramaBoard').children[idx] || null;
}

// ---- Check match ----
function checkMatch() {
    const [a, b] = flipped;
    const cardA = board[a.r][a.c];
    const cardB = board[b.r][b.c];

    if (cardA.value === cardB.value) {
        cardA.matched = true;
        cardB.matched = true;
        matchedCount += 2;
        flipped = [];
        GameAudio.match();
        render();
        updateStats();
        const cfg = DIFFICULTY_CONFIG[currentDifficulty];
        if (matchedCount === cfg.totalCards) {
            setTimeout(() => showVictory(), 300);
        }
    } else {
        // Mismatch: show shake, then flip back
        GameAudio.noMatch();
        const elA = getCardElement(a.r, a.c);
        const elB = getCardElement(b.r, b.c);
        if (elA) elA.classList.add('mismatch');
        if (elB) elB.classList.add('mismatch');

        setTimeout(() => {
            cardA.flipped = false;
            cardB.flipped = false;
            score = Math.max(0, score - 20);
            flipped = [];
            render();
            updateStats();
            if (score <= 0) {
                gameOver(false);
            }
        }, 350);
    }
}

// ---- Stats update ----
let attempts = 0;

function updateStats() {
    const cfg = DIFFICULTY_CONFIG[currentDifficulty];
    const pairs = cfg.totalCards / 2;
    const foundPairs = matchedCount / 2;

    // Score
    animateBump('score', score);
    if (document.getElementById('mScore')) document.getElementById('mScore').textContent = score;

    // High score
    document.getElementById('highScore').textContent = highScore;

    // Pairs found
    const pairsEl = document.getElementById('pairsFound');
    if (pairsEl) animateBump('pairsFound', foundPairs + ' / ' + pairs);

    // Attempts
    const attEl = document.getElementById('attempts');
    if (attEl) animateBump('attempts', Math.floor((attempts)));

    // Timer display
    updateTimerDisplay();
}

function animateBump(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow
    el.classList.add('bump');
    el.addEventListener('transitionend', () => el.classList.remove('bump'), { once: true });
}

function updateTimerDisplay() {
    const formatted = formatTime(elapsedSeconds);
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = formatted;
        // Urgent indicator — flash if > 2 min
        if (elapsedSeconds > 120) {
            timerEl.classList.add('timer-urgent');
        } else {
            timerEl.classList.remove('timer-urgent');
        }
    }
    if (document.getElementById('mTimer')) document.getElementById('mTimer').textContent = formatted;
}

// ---- Timer ----
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isPlaying) return;
        elapsedSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return min + ':' + sec.toString().padStart(2, '0');
}

// ---- Game start / restart ----
function startGame() {
    GameAudio.start();
    stopTimer();
    attempts = 0;
    createBoard();
    isPlaying = true;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('gameOverPopup').style.display = 'none';
    removeVictoryOverlay();
    updateStats();
}

function restartGame() {
    stopTimer();
    startGame();
}

// ---- Victory screen ----
function showVictory() {
    isPlaying = false;
    GameAudio.win();
    stopTimer();

    // Update high score (score-based)
    if (score > highScore) {
        highScore = score;
        GameStore.set('memoramaHighScore', highScore);
    }

    // Best time for this difficulty
    const prevBest = getBestTime(currentDifficulty);
    let newBest = false;
    if (prevBest === null || elapsedSeconds < prevBest) {
        setBestTime(currentDifficulty, elapsedSeconds);
        newBest = true;
    }
    const bestTime = getBestTime(currentDifficulty);

    removeVictoryOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'victory-overlay';
    overlay.id = 'victoryOverlay';

    const box = document.createElement('div');
    box.className = 'victory-box';

    const diffLabel = { easy: 'Facil', normal: 'Normal', hard: 'Dificil' }[currentDifficulty];

    box.innerHTML =
        '<h2>Completado!</h2>' +
        '<div class="victory-stats">' +
            'Dificultad: <strong>' + diffLabel + '</strong><br>' +
            'Tiempo: <strong>' + formatTime(elapsedSeconds) + '</strong><br>' +
            'Puntaje: <strong>' + score + '</strong>' +
        '</div>' +
        (newBest ? '<div class="best-label">Nuevo mejor tiempo!</div>' : '<div class="best-label">Mejor tiempo: ' + formatTime(bestTime) + '</div>') +
        '<br><button id="victoryPlayAgainBtn" style="margin-top:1.2rem;padding:0.9rem 2.2rem;font-size:1.1rem;font-weight:bold;border:none;border-radius:10px;background:#8fd3f4;color:#222;cursor:pointer;">Jugar de nuevo</button>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('victoryPlayAgainBtn').addEventListener('click', () => {
        removeVictoryOverlay();
        startGame();
    });

    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

function removeVictoryOverlay() {
    const existing = document.getElementById('victoryOverlay');
    if (existing) existing.remove();
}

// ---- Game over (time/score ran out) ----
function gameOver(won) {
    isPlaying = false;
    stopTimer();

    if (won && score > highScore) {
        highScore = score;
        GameStore.set('memoramaHighScore', highScore);
    }

    const popup = document.getElementById('gameOverPopup');
    popup.style.display = 'none';
    void popup.offsetWidth;
    popup.style.display = 'flex';

    document.getElementById('finalScore').textContent = won ? 'Ganaste! Puntaje: ' + score : 'Perdiste! Puntaje: 0';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// ---- Difficulty buttons ----
function setupDifficultyButtons() {
    const btns = document.querySelectorAll('.diff-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.diff === currentDifficulty) return;
            currentDifficulty = btn.dataset.diff;
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (isPlaying) startGame();
        });
    });
}

// ---- Inject difficulty selector and stats UI into info-side ----
function injectInfoUI() {
    const infoSide = document.getElementById('infoSide');
    if (!infoSide) return;

    // Difficulty selector — insert before score-panel
    const scorePanel = infoSide.querySelector('.score-panel');

    // Only inject once
    if (!document.querySelector('.difficulty-selector')) {
        const diffDiv = document.createElement('div');
        diffDiv.className = 'difficulty-selector';
        diffDiv.innerHTML =
            '<button class="diff-btn" data-diff="easy">Facil</button>' +
            '<button class="diff-btn active" data-diff="normal">Normal</button>' +
            '<button class="diff-btn" data-diff="hard">Dificil</button>';
        infoSide.insertBefore(diffDiv, scorePanel);
        setupDifficultyButtons();
    }

    // Rebuild score-panel with extra stats
    if (scorePanel) {
        scorePanel.innerHTML =
            '<div class="stat-row"><span class="stat-label">Puntaje:</span><span class="stat-value" id="score">' + score + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Mejor puntaje:</span><span class="stat-value" id="highScore">' + highScore + '</span></div>' +
            '<div class="stat-row"><span class="stat-label">Parejas:</span><span class="stat-value" id="pairsFound">0 / 8</span></div>' +
            '<div class="stat-row"><span class="stat-label">Intentos:</span><span class="stat-value" id="attempts">0</span></div>' +
            '<div class="stat-row"><span class="stat-label">Tiempo:</span><span class="stat-value" id="timer">0:00</span></div>';
    }
}

// ---- Wire up buttons ----
document.getElementById('startBtn').addEventListener('click', () => { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', () => { GameAudio.click(); restartGame(); });
document.getElementById('playAgainBtn').addEventListener('click', () => {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// ---- Init ----
injectInfoUI();

// Initial render (empty board)
updateBoardGrid();
render();
updateTimerDisplay();

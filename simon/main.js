// Simon Says
const COLORS = ['red', 'blue', 'green', 'yellow'];

let sequence = [];
let playerSeq = [];
let round = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('simonHighScore') || '0', 10);
let isPlaying = false;
let isFlashing = false;
let playerTurn = false;

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = round;
    document.getElementById('mobileScore').textContent = 'Ronda: ' + round + ' | Puntaje: ' + score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('simonHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
}

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
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

async function flashSequence() {
    isFlashing = true;
    playerTurn = false;
    setStatus('Observa...');
    // Disable buttons during flash
    setBtnsEnabled(false);

    await delay(500);

    for (var i = 0; i < sequence.length; i++) {
        await flash(sequence[i], 500);
        await delay(200);
    }

    isFlashing = false;
    playerTurn = true;
    setBtnsEnabled(true);
    setStatus('¡Tu turno!');
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
    flashSequence();
}

async function handleInput(color) {
    if (!isPlaying || !playerTurn || isFlashing) return;

    playerSeq.push(color);
    var idx = playerSeq.length - 1;

    // Flash button on input
    await flash(color, 200);

    // Check if correct
    if (playerSeq[idx] !== sequence[idx]) {
        gameOver();
        return;
    }

    // Check if full sequence completed
    if (playerSeq.length === sequence.length) {
        score += round;
        updateScore();
        playerSeq = [];
        playerTurn = false;
        setBtnsEnabled(false);
        setStatus('¡Correcto! Siguiente ronda...');
        await delay(1000);
        addToSequence();
    }
}

function startGame() {
    sequence = [];
    playerSeq = [];
    round = 0;
    score = 0;
    isPlaying = true;
    isFlashing = false;
    playerTurn = false;

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    updateScore();
    setStatus('');

    setTimeout(function() {
        addToSequence();
    }, 500);
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    playerTurn = false;
    setBtnsEnabled(false);
    setStatus('');

    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    if (document.getElementById('mobileStartBtn')) {
        document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

// Wire up buttons
COLORS.forEach(function(color) {
    var btn = document.getElementById('btn-' + color);

    btn.addEventListener('click', function() {
        handleInput(color);
    });

    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleInput(color);
    }, { passive: false });
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init UI
document.getElementById('score').textContent = '0';
document.getElementById('level').textContent = '0';
document.getElementById('highScore').textContent = highScore;
setBtnsEnabled(false);

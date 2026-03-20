// Whack-a-Mole
const TOTAL_HOLES = 9;
const GAME_DURATION = 60;

let score = 0;
let highScore = parseInt(localStorage.getItem('whackHighScore') || '0', 10);
let timeLeft = GAME_DURATION;
let isPlaying = false;
let moleInterval = null;
let timerInterval = null;
let holeTimeouts = [];

const holes = [];

function initGrid() {
    const grid = document.getElementById('moleGrid');
    grid.innerHTML = '';
    holes.length = 0;
    for (let i = 0; i < TOTAL_HOLES; i++) {
        const hole = document.createElement('div');
        hole.classList.add('hole');
        const mole = document.createElement('span');
        mole.classList.add('mole');
        mole.textContent = '🐹';
        hole.appendChild(mole);

        // Click
        hole.addEventListener('click', function() {
            whack(i);
        });

        // Touch
        hole.addEventListener('touchstart', function(e) {
            e.preventDefault();
            whack(i);
        }, { passive: false });

        grid.appendChild(hole);
        holes.push(hole);
    }
}

function popMole() {
    if (!isPlaying) return;

    // Pick a random inactive hole
    const inactive = holes.map((h, i) => i).filter(i => !holes[i].classList.contains('active'));
    if (inactive.length === 0) return;

    const idx = inactive[Math.floor(Math.random() * inactive.length)];
    const hole = holes[idx];
    hole.classList.add('active');

    const duration = Math.max(500, 1200 - score * 25);
    const t = setTimeout(function() {
        hole.classList.remove('active');
    }, duration);
    holeTimeouts.push(t);
}

function whack(i) {
    if (!isPlaying) return;
    const hole = holes[i];
    if (!hole.classList.contains('active')) return;

    score++;
    hole.classList.remove('active');
    hole.classList.add('whacked');
    setTimeout(function() {
        hole.classList.remove('whacked');
    }, 300);

    updateScore();
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('mobileScore').textContent = 'Puntaje: ' + score + ' | Tiempo: ' + timeLeft + 's';
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('whackHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
}

function updateTimer() {
    document.getElementById('timer').textContent = timeLeft;
    document.getElementById('mobileScore').textContent = 'Puntaje: ' + score + ' | Tiempo: ' + timeLeft + 's';
}

function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    isPlaying = true;

    // Clear any pending hole timeouts
    holeTimeouts.forEach(t => clearTimeout(t));
    holeTimeouts = [];

    // Reset all holes
    holes.forEach(h => {
        h.classList.remove('active', 'whacked');
    });

    clearInterval(moleInterval);
    clearInterval(timerInterval);

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    updateScore();
    updateTimer();

    moleInterval = setInterval(popMole, 700);

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
    clearInterval(moleInterval);
    clearInterval(timerInterval);
    holeTimeouts.forEach(t => clearTimeout(t));
    holeTimeouts = [];

    // Hide all moles
    holes.forEach(h => h.classList.remove('active', 'whacked'));

    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;

    // Show mobile start button again
    if (document.getElementById('mobileStartBtn')) {
        document.getElementById('mobileStartBtn').style.display = 'block';
    }
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Initialize grid on load
document.addEventListener('DOMContentLoaded', function() {
    initGrid();
    document.getElementById('score').textContent = '0';
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('timer').textContent = GAME_DURATION;
});

// Also init immediately if DOM is already ready
if (document.readyState !== 'loading') {
    initGrid();
    document.getElementById('score').textContent = '0';
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('timer').textContent = GAME_DURATION;
}

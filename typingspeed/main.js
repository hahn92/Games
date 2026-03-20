// Velocidad de Escritura
var WORDS = [
    'casa','perro','gato','árbol','libro','agua','cielo','luna','sol','mar',
    'fuego','viento','nieve','playa','campo','ciudad','camino','puerta','ventana','mesa',
    'silla','cama','baño','cocina','jardín','flores','fruta','música','baile','juego',
    'rápido','lento','grande','pequeño','fuerte','suave','claro','oscuro','nuevo','viejo',
    'feliz','triste','amigo','familia','trabajo','tiempo','dinero','color','forma','luz',
    'mano','pie','cara','ojo','boca','nariz','pelo','brazo','pierna','corazón',
    'mundo','tierra','aire','piedra','metal','papel','tela','vidrio','madera','plástico',
    'comer','beber','dormir','correr','saltar','cantar','leer','escribir','pensar','hablar',
    'escuela','hospital','mercado','parque','banco','iglesia','museo','teatro','cine','tienda',
    'rojo','azul','verde','negro','blanco','amarillo','naranja','morado','rosa','gris',
    'uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
    'español','inglés','francés','italiano','alemán','chino','japón','brasil','perú','chile'
];

var TIME_LIMIT = 60;
var isPlaying = false;
var timerInterval = null;
var timeLeft = TIME_LIMIT;
var wordCount = 0;
var currentWordIndex = 0;
var wordQueue = [];
var highScore = parseInt(localStorage.getItem('typingHigh') || '0', 10);

function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

function buildWordQueue() {
    wordQueue = [];
    var shuffled = shuffle(WORDS);
    // repeat if needed
    while (wordQueue.length < 200) wordQueue = wordQueue.concat(shuffled);
    currentWordIndex = 0;
}

function showCurrentWord() {
    document.getElementById('targetWord').textContent = wordQueue[currentWordIndex].toUpperCase();
    updateUpcoming();
}

function updateUpcoming() {
    var container = document.getElementById('upcomingWords');
    container.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
        if (currentWordIndex + i < wordQueue.length) {
            var span = document.createElement('span');
            span.className = 'upcoming-word';
            span.textContent = wordQueue[currentWordIndex + i];
            container.appendChild(span);
        }
    }
}

function updateHUD() {
    var wpm = Math.round(wordCount / ((TIME_LIMIT - timeLeft) / 60)) || 0;
    if (isNaN(wpm) || !isFinite(wpm)) wpm = 0;
    document.getElementById('timerDisplay').textContent = timeLeft;
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('wpm').textContent = wpm;
    document.getElementById('score').textContent = wpm;
    document.getElementById('totalWords').textContent = wordCount;
    document.getElementById('timerBar').style.width = (timeLeft / TIME_LIMIT * 100) + '%';
    document.getElementById('mobileScore').textContent = wordCount + ' palabras | ' + wpm + ' WPM';
}

function nextWord() {
    currentWordIndex++;
    wordCount++;
    showCurrentWord();
    updateHUD();
    var input = document.getElementById('wordInput');
    input.value = '';
    input.classList.remove('correct', 'wrong');
}

function startGame() {
    buildWordQueue();
    wordCount = 0;
    timeLeft = TIME_LIMIT;
    isPlaying = true;
    clearInterval(timerInterval);

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    var input = document.getElementById('wordInput');
    input.value = '';
    input.disabled = false;
    input.classList.remove('correct', 'wrong');
    input.focus();

    showCurrentWord();
    updateHUD();
    document.getElementById('highScore').textContent = highScore;

    timerInterval = setInterval(function() {
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) {
            timeLeft = 0;
            updateHUD();
            endGame();
        }
    }, 1000);
}

function endGame() {
    isPlaying = false;
    clearInterval(timerInterval);
    var input = document.getElementById('wordInput');
    input.disabled = true;
    input.value = '';

    var wpm = Math.round(wordCount / (TIME_LIMIT / 60));
    if (wpm > highScore) {
        highScore = wpm;
        localStorage.setItem('typingHigh', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('finalScore').textContent = wpm + ' palabras por minuto';
    document.getElementById('finalWords').textContent = wordCount + ' palabras en total';
    document.getElementById('gameOverPopup').style.display = 'flex';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// Input handling
document.getElementById('wordInput').addEventListener('input', function() {
    if (!isPlaying) return;
    var val = this.value.trim().toLowerCase();
    var target = wordQueue[currentWordIndex].toLowerCase();
    if (val === target) {
        this.classList.add('correct');
        this.classList.remove('wrong');
        setTimeout(nextWord, 80);
    } else if (target.startsWith(val)) {
        this.classList.remove('correct', 'wrong');
    } else {
        this.classList.add('wrong');
        this.classList.remove('correct');
    }
});

document.getElementById('wordInput').addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        var val = this.value.trim().toLowerCase();
        var target = wordQueue[currentWordIndex].toLowerCase();
        if (val === target) { nextWord(); }
        else { this.value = ''; this.classList.remove('correct','wrong'); }
    }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// Init
document.getElementById('highScore').textContent = highScore;
document.getElementById('timerBar').style.width = '100%';

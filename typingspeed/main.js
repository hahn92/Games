// Velocidad de Escritura
var WORDS_SHORT = [
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

// Harder/longer words introduced in last 20s
var WORDS_HARD = [
    'aplicación','tecnología','universidad','comunicación','fotografía',
    'biblioteca','transportar','construcción','electricidad','arquitectura',
    'administración','desarrollador','investigación','conocimiento','experiencia',
    'responsabilidad','oportunidad','personalidad','biodiversidad','competencia'
];

var WORDS = WORDS_SHORT.slice();

// Time modes
var TIME_OPTIONS = [30, 60, 90];
var TIME_LIMIT = 60;
var isPlaying = false;
var timerInterval = null;
var timeLeft = TIME_LIMIT;
var wordCount = 0;
var currentWordIndex = 0;
var wordQueue = [];
var highScore = GameStore.getNum('typingHigh', 0);
var prevWpm = 0;
var currentStreak = 0;
var bestStreak = 0;
var totalAttempts = 0;
var correctAttempts = 0;

// ===================== UTILS =====================
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
    var shuffledShort = shuffle(WORDS_SHORT);
    var shuffledHard  = shuffle(WORDS_HARD);
    var combined = shuffledShort.concat(shuffledHard);
    while (wordQueue.length < 300) wordQueue = wordQueue.concat(combined);
    currentWordIndex = 0;
}

// ===================== TIME SELECTOR =====================
function injectTimeSelector() {
    var panel = document.querySelector('.typing-panel');
    if (!panel) return;
    var wrap = document.createElement('div');
    wrap.className = 'time-selector';
    wrap.id = 'timeSelector';
    TIME_OPTIONS.forEach(function(t) {
        var btn = document.createElement('button');
        btn.className = 'time-btn' + (t === TIME_LIMIT ? ' active' : '');
        btn.textContent = t + 's';
        btn.dataset.time = t;
        btn.addEventListener('click', function() {
            if (isPlaying) return;
            TIME_LIMIT = parseInt(this.dataset.time);
            timeLeft = TIME_LIMIT;
            document.querySelectorAll('.time-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('timerDisplay').textContent = TIME_LIMIT;
            document.getElementById('timerBar').style.width = '100%';
            updateTimerBarColor();
        });
        wrap.appendChild(btn);
    });
    panel.insertBefore(wrap, panel.firstChild);
}

// ===================== WORD DISPLAY =====================
function scaleWordDisplay(word, el) {
    var len = word.length;
    var size, spacing;
    if (len <= 7) {
        size = '3.5rem'; spacing = '4px';
    } else if (len <= 9) {
        size = '2.8rem'; spacing = '2px';
    } else if (len <= 12) {
        size = '2.2rem'; spacing = '1px';
    } else {
        size = '1.7rem'; spacing = '0px';
    }
    el.style.fontSize = size;
    el.style.letterSpacing = spacing;
}

function showCurrentWord(animate) {
    var el = document.getElementById('targetWord');
    var word = wordQueue[currentWordIndex];
    if (animate) {
        el.classList.add('fade-out');
        setTimeout(function() {
            el.textContent = word.toUpperCase();
            scaleWordDisplay(word, el);
            el.classList.remove('fade-out');
            el.classList.add('fade-in');
            setTimeout(function() { el.classList.remove('fade-in'); }, 200);
        }, 100);
    } else {
        el.textContent = word.toUpperCase();
        scaleWordDisplay(word, el);
    }
    updateUpcoming();
}

function updateUpcoming() {
    var container = document.getElementById('upcomingWords');
    container.innerHTML = '';
    for (var i = 1; i <= 4; i++) {
        if (currentWordIndex + i < wordQueue.length) {
            var span = document.createElement('span');
            span.className = 'upcoming-word';
            span.textContent = wordQueue[currentWordIndex + i];
            container.appendChild(span);
        }
    }
}

// ===================== TIMER BAR =====================
function updateTimerBarColor() {
    var bar = document.getElementById('timerBar');
    var pct = timeLeft / TIME_LIMIT;
    bar.classList.remove('warning', 'danger');
    if (pct <= 0.2)      bar.classList.add('danger');
    else if (pct <= 0.4) bar.classList.add('warning');
}

// ===================== HUD =====================
function updateHUD() {
    var elapsed = TIME_LIMIT - timeLeft;
    var wpm = elapsed > 0 ? Math.round(wordCount / (elapsed / 60)) : 0;
    if (isNaN(wpm) || !isFinite(wpm)) wpm = 0;

    document.getElementById('timerDisplay').textContent = timeLeft;
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('score').textContent = wpm;
    document.getElementById('totalWords').textContent = wordCount;

    // WPM bump animation
    var wpmEl = document.getElementById('wpm');
    if (wpm > prevWpm) {
        wpmEl.classList.remove('bump');
        void wpmEl.offsetWidth;
        wpmEl.classList.add('bump');
        setTimeout(function() { wpmEl.classList.remove('bump'); }, 250);
    }
    prevWpm = wpm;
    wpmEl.textContent = wpm;

    // Timer bar
    var bar = document.getElementById('timerBar');
    bar.style.width = (timeLeft / TIME_LIMIT * 100) + '%';
    updateTimerBarColor();

    document.getElementById('mobileScore').textContent = wordCount + ' palabras | ' + wpm + ' WPM';
}

// ===================== CHECK FLASH =====================
function showCheckFlash() {
    var wrap = document.querySelector('.target-word-wrap');
    if (!wrap) return;
    var flash = document.createElement('span');
    flash.className = 'check-flash';
    flash.textContent = '✓';
    flash.style.left = (Math.random() * 60 + 20) + '%';
    wrap.appendChild(flash);
    setTimeout(function() { if (flash.parentNode) flash.remove(); }, 650);
}

// ===================== STREAK =====================
function updateStreakBadge() {
    var badge = document.getElementById('streakBadge');
    if (!badge) return;
    if (currentStreak >= 3) {
        badge.textContent = 'Racha: ' + currentStreak + ' 🔥';
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

// ===================== NEXT WORD =====================
function nextWord() {
    GameAudio.score();
    showCheckFlash();
    currentWordIndex++;
    wordCount++;
    correctAttempts++;
    currentStreak++;
    if (currentStreak > bestStreak) bestStreak = currentStreak;
    updateStreakBadge();
    showCurrentWord(true);
    updateHUD();
    var input = document.getElementById('wordInput');
    input.value = '';
    input.classList.remove('correct', 'wrong');
}

// ===================== START =====================
function startGame() {
    GameAudio.start();
    buildWordQueue();
    wordCount = 0;
    timeLeft = TIME_LIMIT;
    isPlaying = true;
    prevWpm = 0;
    currentStreak = 0;
    bestStreak = 0;
    totalAttempts = 0;
    correctAttempts = 0;
    clearInterval(timerInterval);

    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;

    var input = document.getElementById('wordInput');
    input.value = '';
    input.disabled = false;
    input.classList.remove('correct', 'wrong');
    input.focus();

    var badge = document.getElementById('streakBadge');
    if (badge) badge.classList.remove('visible');

    showCurrentWord(false);
    updateHUD();
    document.getElementById('highScore').textContent = highScore;

    timerInterval = setInterval(function() {
        timeLeft--;
        updateHUD();

        // In last 20s introduce harder words randomly
        if (timeLeft <= 20 && timeLeft > 0) {
            var idx = currentWordIndex;
            // Replace upcoming words with harder ones occasionally
            for (var i = 1; i <= 3; i++) {
                if (idx + i < wordQueue.length && Math.random() < 0.3) {
                    var hard = WORDS_HARD[Math.floor(Math.random() * WORDS_HARD.length)];
                    wordQueue[idx + i] = hard;
                }
            }
            updateUpcoming();
        }

        if (timeLeft <= 0) {
            timeLeft = 0;
            updateHUD();
            endGame();
        }
    }, 1000);
}

// ===================== END =====================
function endGame() {
    isPlaying = false;
    GameAudio.gameOver();
    clearInterval(timerInterval);
    var input = document.getElementById('wordInput');
    input.disabled = true;
    input.value = '';

    var wpm = Math.round(wordCount / (TIME_LIMIT / 60));
    var accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
    if (wpm > highScore) {
        highScore = wpm;
        GameStore.set('typingHigh', highScore);
    }
    document.getElementById('highScore').textContent = highScore;

    // Build result popup
    var popup = document.getElementById('gameOverPopup');
    var content = popup.querySelector('.popup-content');
    content.classList.add('animated');
    content.innerHTML =
        '<h2>¡Tiempo!</h2>' +
        '<div class="result-grid">' +
            '<div class="result-item"><div class="r-label">WPM</div><div class="r-value">' + wpm + '</div></div>' +
            '<div class="result-item"><div class="r-label">Palabras</div><div class="r-value">' + wordCount + '</div></div>' +
            '<div class="result-item"><div class="r-label">Precisión</div><div class="r-value">' + accuracy + '%</div></div>' +
            '<div class="result-item"><div class="r-label">Mejor racha</div><div class="r-value">' + bestStreak + ' 🔥</div></div>' +
        '</div>' +
        (wpm >= highScore && wpm > 0 ? '<p style="color:#ffd700;font-size:1rem;margin:0.5rem 0">¡Nuevo récord!</p>' : '') +
        '<button id="playAgainBtn">Jugar de nuevo</button>';

    // Re-attach event
    content.querySelector('#playAgainBtn').addEventListener('click', function() {
        GameAudio.click();
        popup.style.display = 'none';
        startGame();
    });

    popup.style.display = 'flex';
    // Trigger animation
    void content.offsetWidth;

    document.getElementById('startBtn').disabled = false;
    document.getElementById('restartBtn').disabled = true;
}

// ===================== INPUT =====================
document.getElementById('wordInput').addEventListener('input', function() {
    if (!isPlaying) return;
    totalAttempts = Math.max(totalAttempts, wordCount + 1);
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
        currentStreak = 0;
        updateStreakBadge();
        GameAudio.hit();
    }
});

document.getElementById('wordInput').addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        var val = this.value.trim().toLowerCase();
        var target = wordQueue[currentWordIndex].toLowerCase();
        totalAttempts = Math.max(totalAttempts, wordCount + 1);
        if (val === target) {
            nextWord();
        } else {
            this.value = '';
            this.classList.remove('correct','wrong');
            currentStreak = 0;
            updateStreakBadge();
        }
    }
});

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

// ===================== INJECT EXTRA UI =====================
(function injectUI() {
    // Wrap target word for flash overlay
    var targetEl = document.getElementById('targetWord');
    if (targetEl && !targetEl.parentElement.classList.contains('target-word-wrap')) {
        var wrap = document.createElement('div');
        wrap.className = 'target-word-wrap';
        targetEl.parentNode.insertBefore(wrap, targetEl);
        wrap.appendChild(targetEl);
    }

    // WPM display: replace inline wpm span with large prominent one
    var wpmEl = document.getElementById('wpm');
    if (wpmEl && !wpmEl.classList.contains('wpm-number')) {
        wpmEl.className = 'wpm-number';
        var parent = wpmEl.parentElement;
        parent.className = 'wpm-display';
        var label = document.createElement('span');
        label.className = 'wpm-label';
        label.textContent = 'WPM';
        parent.appendChild(label);
    }

    // Streak badge
    var panel = document.querySelector('.typing-panel');
    if (panel) {
        var badge = document.createElement('div');
        badge.className = 'streak-badge';
        badge.id = 'streakBadge';
        badge.textContent = 'Racha: 0 🔥';
        panel.insertBefore(badge, panel.querySelector('.target-word-wrap') || panel.querySelector('.target-word'));
    }

    // Time selector
    injectTimeSelector();
})();

// Init
document.getElementById('highScore').textContent = highScore;
document.getElementById('timerBar').style.width = '100%';
document.getElementById('timerDisplay').textContent = TIME_LIMIT;

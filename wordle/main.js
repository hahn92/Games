// Wordle en Español
var WORDS = [
    'AVION','BALÓN','CAMPO','DANZA','FIERO','GLOBO','HIELO','JUEGO','LARGO','MARCA',
    'NOCHE','OMEGA','PASEO','RADIO','SALSA','TECHO','ÚNICO','VALOR','YERNO','ZORRO',
    'ÁRBOL','BOLSO','CARRO','DIQUE','FINCA','GRAMO','HOTEL','LIBRO','MAGIA','NOBLE',
    'ORDEN','PLAZA','QUESO','ROCÍO','SALTO','TIGRE','VAPOR','VUELO','BRAZO','CRUEL',
    'DULCE','GANSO','HUMOR','IDEAL','JAMÓN','LACRE','MAYOR','NIETO','OCASO',
    'PAPEL','SEÑAL','TUMOR','UNIÓN','VIAJE','ZOMBI','ACERO','BEIGE','COGER',
    'DISCO','ENOJO','GENIO','HÁBIL','IMPAR','JAQUE','LLAVE','MADRE','NARIZ',
    'PERLA','RASGO','SUELO','TRUCO','ULTRA','VIGOR','ABRIR','BANCO','CIFRA',
    'DENSO','ETAPA','FLOTA','GRUPO','JUSTO','LECHE','NIEVE',
    'PALMA','QUEJA','RANGO','SABIO','TEXTO','VAINA','BUSTO','CLAVO',
    'DELTA','FRUTA','GUSTO','JUNCO','LIMÓN','MONJE','NUEVE','PESCA',
    'REINA','SABER','TANGO','VELLO','AGUJA','BUCEO','CERDO','DEBER','FUROR'
].filter(function(w) { return w.length === 5; });

var KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L','Ñ'],
    ['ENTER','Z','X','C','V','B','N','M','⌫']
];

var target, grid, currentRow, currentCol, isPlaying, gameEnded;
var wins, streak, bestStreak;
wins        = parseInt(localStorage.getItem('wordleWins')       || '0', 10);
streak      = parseInt(localStorage.getItem('wordleStreak')     || '0', 10);
bestStreak  = parseInt(localStorage.getItem('wordleBestStreak') || '0', 10);

// distribution[i] = number of wins in (i+1) attempts, i=0..5
var distribution = (function () {
    try {
        var d = JSON.parse(localStorage.getItem('wordleDist') || '[0,0,0,0,0,0]');
        if (Array.isArray(d) && d.length === 6) return d;
    } catch (e) {}
    return [0, 0, 0, 0, 0, 0];
}());

var keyStatus = {}; // letter -> 'correct' | 'present' | 'absent'

// ===================== GRID =====================
function buildGrid() {
    var container = document.getElementById('wordleGrid');
    container.innerHTML = '';
    grid = [];
    for (var r = 0; r < 6; r++) {
        grid[r] = [];
        for (var c = 0; c < 5; c++) {
            var tile = document.createElement('div');
            tile.className = 'wordle-tile';
            tile.id = 'tile-' + r + '-' + c;
            container.appendChild(tile);
            grid[r][c] = { el: tile, letter: '' };
        }
    }
}

// ===================== KEYBOARD =====================
function buildKeyboard() {
    var rows = ['keyRow1','keyRow2','keyRow3'];
    for (var r = 0; r < 3; r++) {
        var row = document.getElementById(rows[r]);
        row.innerHTML = '';
        for (var k = 0; k < KEYBOARD_ROWS[r].length; k++) {
            var key = KEYBOARD_ROWS[r][k];
            var btn = document.createElement('button');
            btn.className = 'key-btn' + (key.length > 1 ? ' wide' : '');
            btn.textContent = key;
            btn.dataset.key = key;
            btn.id = 'key-' + key;
            btn.addEventListener('click', function() { handleKey(this.dataset.key); });
            row.appendChild(btn);
        }
    }
}

function updateKeyboard() {
    for (var letter in keyStatus) {
        var el = document.getElementById('key-' + letter);
        if (el) {
            el.className = 'key-btn' + (letter.length > 1 ? ' wide' : '') + ' ' + keyStatus[letter];
        }
    }
}

// ===================== STATUS =====================
function setStatus(msg) { document.getElementById('statusMsg').textContent = msg; }

// ===================== TOAST =====================
function showToast(msg) {
    var old = document.getElementById('wordleToast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'wordleToast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 3100);
}

// ===================== TILE HIGHLIGHT =====================
function highlightCurrentTile() {
    // Remove pulsing from all tiles in current row
    for (var c = 0; c < 5; c++) {
        if (grid[currentRow] && grid[currentRow][c]) {
            var el = grid[currentRow][c].el;
            el.classList.remove('filled');
        }
    }
    // Add pulsing border to the tile that will receive the next letter
    if (currentCol < 5 && grid[currentRow] && grid[currentRow][currentCol]) {
        var nextTile = grid[currentRow][currentCol].el;
        if (!nextTile.textContent) {
            nextTile.classList.add('filled');
        }
    }
}

// ===================== INPUT =====================
function handleKey(key) {
    if (!isPlaying || gameEnded) return;
    if (key === '⌫' || key === 'Backspace') {
        if (currentCol > 0) {
            currentCol--;
            grid[currentRow][currentCol].letter = '';
            grid[currentRow][currentCol].el.textContent = '';
            grid[currentRow][currentCol].el.classList.remove('filled', 'pop');
            highlightCurrentTile();
        }
    } else if (key === 'ENTER' || key === 'Enter') {
        submitGuess();
    } else if (/^[A-ZÑ]$/.test(key) && currentCol < 5) {
        grid[currentRow][currentCol].letter = key;
        grid[currentRow][currentCol].el.textContent = key;
        GameAudio.type();
        // Remove filled (pulsing) from this tile, add pop
        grid[currentRow][currentCol].el.classList.remove('filled', 'pop');
        // Force reflow to restart animation
        void grid[currentRow][currentCol].el.offsetWidth;
        grid[currentRow][currentCol].el.classList.add('pop');
        currentCol++;
        highlightCurrentTile();
    }
}

// ===================== SHAKE ROW =====================
function shakeCurrentRow() {
    var rowTiles = grid[currentRow].map(function(t) { return t.el; });
    rowTiles.forEach(function(el) {
        el.classList.remove('row-shake');
        void el.offsetWidth;
        el.classList.add('row-shake');
        setTimeout(function() { el.classList.remove('row-shake'); }, 450);
    });
}

// ===================== SUBMIT =====================
function submitGuess() {
    if (currentCol < 5) {
        setStatus('Escribe 5 letras');
        shakeCurrentRow();
        return;
    }
    var guess = grid[currentRow].map(function(t) { return t.letter; }).join('');

    var targetArr = target.split('');
    var result = ['absent','absent','absent','absent','absent'];

    // Mark correct first
    var tempTarget = targetArr.slice();
    for (var i = 0; i < 5; i++) {
        if (guess[i] === target[i]) { result[i] = 'correct'; tempTarget[i] = null; }
    }
    // Mark present
    for (var i = 0; i < 5; i++) {
        if (result[i] !== 'correct') {
            var idx = tempTarget.indexOf(guess[i]);
            if (idx >= 0) { result[i] = 'present'; tempTarget[idx] = null; }
        }
    }

    // Remove any pulsing border from current row before flipping
    for (var c = 0; c < 5; c++) {
        grid[currentRow][c].el.classList.remove('filled');
    }

    // Animate tiles: flip 3D, reveal color at mid-flip
    for (var i = 0; i < 5; i++) {
        (function(idx, res) {
            var delay = idx * 200;
            setTimeout(function() {
                var el = grid[currentRow][idx].el;
                el.classList.remove('pop', 'row-shake');
                el.classList.add('flip');
                // Apply color at midpoint (250ms into the 500ms flip)
                setTimeout(function() {
                    el.classList.add(res);
                    el.classList.remove('flip');
                    // Update key status (priority: correct > present > absent)
                    var l = guess[idx];
                    if (!keyStatus[l] || (keyStatus[l] === 'absent' && res !== 'absent') ||
                        (keyStatus[l] === 'present' && res === 'correct')) {
                        keyStatus[l] = res;
                    }
                    if (idx === 4) updateKeyboard();
                }, 250);
            }, delay);
        })(i, result[i]);
    }

    var totalDelay = 4 * 200 + 500; // last tile starts at 800ms, finishes 250ms in
    setTimeout(function() {
        // Sound based on result composition
        var hasCorrect = result.indexOf('correct') >= 0;
        var hasPresent = result.indexOf('present') >= 0;
        var allAbsent = result.every(function(r) { return r === 'absent'; });
        if (hasCorrect) GameAudio.correct();
        else if (hasPresent) GameAudio.present();
        else if (allAbsent) GameAudio.absent();

        if (guess === target) {
            wins++; streak++;
            if (streak > bestStreak) bestStreak = streak;
            distribution[currentRow]++;
            try { localStorage.setItem('wordleWins', wins); } catch (e) {}
            try { localStorage.setItem('wordleStreak', streak); } catch (e) {}
            try { localStorage.setItem('wordleBestStreak', bestStreak); } catch (e) {}
            try { localStorage.setItem('wordleDist', JSON.stringify(distribution)); } catch (e) {}
            updateScores();
            // Bounce winning row
            for (var b = 0; b < 5; b++) {
                (function(bi) {
                    setTimeout(function() {
                        var el = grid[currentRow][bi].el;
                        el.classList.add('bounce');
                        setTimeout(function() { el.classList.remove('bounce'); }, 600);
                    }, bi * 100);
                })(b);
            }
            var attemptsText = (currentRow + 1) === 1 ? '1 intento' : (currentRow + 1) + ' intentos';
            GameAudio.win();
            showToast('¡Correcto en ' + attemptsText + '!');
            setTimeout(function() {
                document.getElementById('popupTitle').textContent = '¡Ganaste!';
                document.getElementById('finalScore').textContent = 'Lo adivinaste en ' + attemptsText;
                document.getElementById('revealWord').textContent = '';
                showPopup();
            }, 700);
            gameEnded = true;
        } else {
            currentRow++;
            currentCol = 0;
            if (currentRow >= 6) {
                streak = 0;
                try { localStorage.setItem('wordleStreak', 0); } catch (e) {}
                updateScores();
                GameAudio.gameOver();
                showToast('La palabra era: ' + target);
                setTimeout(function() {
                    document.getElementById('popupTitle').textContent = '¡Sin suerte!';
                    document.getElementById('finalScore').textContent = 'Usaste todos los intentos';
                    document.getElementById('revealWord').textContent = 'La palabra era: ' + target;
                    showPopup();
                }, 700);
                gameEnded = true;
            } else {
                setStatus('Intento ' + (currentRow + 1) + ' de 6');
                highlightCurrentTile();
            }
        }
    }, totalDelay);
}

function showPopup() {
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 400);
}

// ===================== SCORES + DISTRIBUTION =====================
function updateScores() {
    document.getElementById('wins').textContent = wins;
    document.getElementById('streak').textContent = streak;
    document.getElementById('bestStreak').textContent = bestStreak;
    document.getElementById('mobileScore').textContent = 'Ganad:' + wins + ' Racha:' + streak;
    updateDistribution();
}

function updateDistribution() {
    var container = document.getElementById('distContainer');
    if (!container) return;
    var maxVal = Math.max.apply(null, distribution.concat([1]));
    container.innerHTML = '';
    for (var i = 0; i < 6; i++) {
        var row = document.createElement('div');
        row.className = 'dist-row';
        var label = document.createElement('span');
        label.className = 'dist-label';
        label.textContent = (i + 1);
        var wrap = document.createElement('div');
        wrap.className = 'dist-bar-wrap';
        var bar = document.createElement('div');
        bar.className = 'dist-bar';
        var pct = Math.max(4, Math.round((distribution[i] / maxVal) * 100));
        bar.style.width = pct + '%';
        bar.textContent = distribution[i] > 0 ? distribution[i] : '';
        wrap.appendChild(bar);
        row.appendChild(label);
        row.appendChild(wrap);
        container.appendChild(row);
    }
}

// ===================== START =====================
function startGame() {
    GameAudio.start();
    target = WORDS[Math.floor(Math.random() * WORDS.length)];
    currentRow = 0; currentCol = 0;
    isPlaying = true; gameEnded = false;
    keyStatus = {};
    buildGrid();
    buildKeyboard();
    setStatus('Intento 1 de 6');
    document.getElementById('gameOverPopup').style.display = 'none';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('restartBtn').disabled = false;
    updateScores();
    // Highlight first tile
    setTimeout(highlightCurrentTile, 50);
}

// ===================== PHYSICAL KEYBOARD =====================
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    var key = e.key.toUpperCase();
    if (key === 'BACKSPACE') handleKey('Backspace');
    else if (key === 'ENTER') handleKey('Enter');
    else if (/^[A-ZÑ]$/.test(key)) handleKey(key);
});

// ===================== INJECT STATS SECTION =====================
(function injectStats() {
    var infoSide = document.getElementById('infoSide');
    if (!infoSide) return;

    // Update score panel labels with icons
    var scorePanel = infoSide.querySelector('.score-panel');
    if (scorePanel) {
        scorePanel.innerHTML =
            '<span><span class="streak-icon">🏆</span> Victorias: <span id="wins">0</span></span>' +
            '<span><span class="streak-icon">🔥</span> Racha: <span id="streak">0</span></span>' +
            '<span><span class="streak-icon">⭐</span> Mejor racha: <span id="bestStreak">0</span></span>';
    }

    // Add distribution section
    var statsSection = document.createElement('div');
    statsSection.className = 'stats-section';
    statsSection.innerHTML = '<h3>Distribución de intentos</h3><div id="distContainer"></div>';
    infoSide.appendChild(statsSection);
})();

document.getElementById('startBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', function() { GameAudio.click(); startGame(); });
document.getElementById('playAgainBtn').addEventListener('click', function() {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

buildGrid();
buildKeyboard();
updateScores();

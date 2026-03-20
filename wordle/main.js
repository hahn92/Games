// Wordle en Español
var WORDS = [
    'AVION','BALÓN','CAMPO','DANZA','FIERO','GLOBO','HIELO','JUEGO','LARGO','MARCA',
    'NOCHE','OMEGA','PASEO','RADIO','SALSA','TECHO','ÚNICO','VALOR','YERNO','ZORRO',
    'ÁRBOL','BOLSO','CARRO','DIQUE','FINCA','GRAMO','HOTEL','LIBRO','MAGIA','NOBLE',
    'ORDEN','PLAZA','QUESO','ROCÍO','SALTO','TIGRE','VAPOR','VUELO','BRAZO','CRUEL',
    'DULCE','FÁBRI','GANSO','HUMOR','IDEAL','JAMÓN','LACRE','MAYOR','NIETO','OCASO',
    'PAPEL','REGAL','SEÑAL','TUMOR','UNIÓN','VIAJE','ZOMBI','ACERO','BEIGE','COGER',
    'DISCO','ENOJO','FIERO','GENIO','HÁBIL','IMPAR','JAQUE','LLAVE','MADRE','NARIZ',
    'OFRENDA','PERLA','RASGO','SUELO','TRUCO','ULTRA','VIGOR','ABRIR','BANCO','CIFRA',
    'DENSO','ETAPA','FLOTA','GRUPO','ÍNDICE','JUSTO','LECHE','MEZCL','NIEVE','OJEAR',
    'PALMA','QUEJA','RANGO','SABIO','TEXTO','UMBRA','VAINA','ABUELO','BUSTO','CLAVO',
    'DELTA','ESFERA','FRUTA','GUSTO','INTRO','JUNCO','LIMÓN','MONJE','NUEVE','PESCA',
    'REINA','SABER','TANGO','VELLO','AGUJA','BUCEO','CERDO','DEBER','ENFAD','FUROR'
].filter(function(w) { return w.length === 5; });

var KEYBOARD_ROWS = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L','Ñ'],
    ['ENTER','Z','X','C','V','B','N','M','⌫']
];

var target, grid, currentRow, currentCol, isPlaying, gameEnded;
var wins, streak, bestStreak;
wins = parseInt(localStorage.getItem('wordleWins') || '0', 10);
streak = parseInt(localStorage.getItem('wordleStreak') || '0', 10);
bestStreak = parseInt(localStorage.getItem('wordleBestStreak') || '0', 10);

var keyStatus = {}; // letter -> 'correct' | 'present' | 'absent'

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

function setStatus(msg) { document.getElementById('statusMsg').textContent = msg; }

function handleKey(key) {
    if (!isPlaying || gameEnded) return;
    if (key === '⌫' || key === 'Backspace') {
        if (currentCol > 0) {
            currentCol--;
            grid[currentRow][currentCol].letter = '';
            grid[currentRow][currentCol].el.textContent = '';
            grid[currentRow][currentCol].el.classList.remove('filled');
        }
    } else if (key === 'ENTER' || key === 'Enter') {
        submitGuess();
    } else if (/^[A-ZÑ]$/.test(key) && currentCol < 5) {
        grid[currentRow][currentCol].letter = key;
        grid[currentRow][currentCol].el.textContent = key;
        grid[currentRow][currentCol].el.classList.add('filled');
        currentCol++;
    }
}

function submitGuess() {
    if (currentCol < 5) { setStatus('Escribe 5 letras'); return; }
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

    // Animate tiles
    for (var i = 0; i < 5; i++) {
        (function(idx, res) {
            setTimeout(function() {
                grid[currentRow][idx].el.classList.add(res);
                grid[currentRow][idx].el.classList.remove('filled');
                // Update key status (priority: correct > present > absent)
                var l = guess[idx];
                if (!keyStatus[l] || (keyStatus[l] === 'absent' && res !== 'absent') || (keyStatus[l] === 'present' && res === 'correct')) {
                    keyStatus[l] = res;
                }
                if (idx === 4) updateKeyboard();
            }, idx * 100);
        })(i, result[i]);
    }

    setTimeout(function() {
        if (guess === target) {
            wins++; streak++;
            if (streak > bestStreak) bestStreak = streak;
            localStorage.setItem('wordleWins', wins);
            localStorage.setItem('wordleStreak', streak);
            localStorage.setItem('wordleBestStreak', bestStreak);
            updateScores();
            document.getElementById('popupTitle').textContent = '¡Ganaste! 🎉';
            document.getElementById('finalScore').textContent = 'Lo adivinaste en ' + (currentRow + 1) + (currentRow === 0 ? ' intento' : ' intentos');
            document.getElementById('revealWord').textContent = '';
            showPopup();
            gameEnded = true;
        } else {
            currentRow++;
            currentCol = 0;
            if (currentRow >= 6) {
                streak = 0;
                localStorage.setItem('wordleStreak', 0);
                updateScores();
                document.getElementById('popupTitle').textContent = '¡Sin suerte! 😔';
                document.getElementById('finalScore').textContent = 'Usaste todos los intentos';
                document.getElementById('revealWord').textContent = 'La palabra era: ' + target;
                showPopup();
                gameEnded = true;
            } else {
                setStatus('Intento ' + (currentRow + 1) + ' de 6');
            }
        }
    }, 600);
}

function showPopup() {
    setTimeout(function() {
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, 400);
}

function updateScores() {
    document.getElementById('wins').textContent = wins;
    document.getElementById('streak').textContent = streak;
    document.getElementById('bestStreak').textContent = bestStreak;
    document.getElementById('mobileScore').textContent = 'Ganad:' + wins + ' Racha:' + streak;
}

function startGame() {
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
}

// Physical keyboard
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    var key = e.key.toUpperCase();
    if (key === 'BACKSPACE') handleKey('Backspace');
    else if (key === 'ENTER') handleKey('Enter');
    else if (/^[A-ZÑ]$/.test(key)) handleKey(key);
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', function() {
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});

buildGrid();
buildKeyboard();
updateScores();

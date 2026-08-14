const SIZE = 4;
// Rejilla vacía desde el principio: el render() del final del archivo se ejecuta
// al cargar la página, antes de que startGame() llame a createBoard(), y con
// `board` sin definir lanzaba un TypeError en cada carga.
let board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
let score = 0, highScore = GameStore.getNum('2048HighScore', 0);
let isPlaying = false;
let winPlayed = false;

// Track which cells are new or merged this turn for animations
let newCells = [];
let mergedCells = [];

function createBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    newCells = [];
    mergedCells = [];
    addTile();
    addTile();
    render();
}

function addTile() {
    let empty = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === 0) empty.push([r, c]);
        }
    }
    if (empty.length) {
        let [r, c] = empty[Math.floor(Math.random() * empty.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
        newCells.push(r * SIZE + c);
    }
}

var gameHud = GU.hud({
    score: 'score',
    mobile: { el: 'mobileScore', format: function () { return 'Puntaje: ' + score; } }
});

function render() {
    const container = document.getElementById('game2048');
    container.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const val = board[r][c];
            const idx = r * SIZE + c;
            const tile = document.createElement('div');
            tile.className = 'tile';

            if (val) {
                // Classify tile value
                if (val > 2048) {
                    tile.classList.add('tile-super');
                } else {
                    tile.classList.add('tile-' + val);
                }
                // Responsive font size for 4-digit numbers
                if (val >= 1000) {
                    tile.style.fontSize = '';  // handled by CSS classes
                }
                tile.dataset.value = val;
                tile.textContent = val;
            } else {
                tile.dataset.value = 0;
            }

            // Animations
            if (newCells.includes(idx)) {
                tile.classList.add('tile-new');
            }
            if (mergedCells.includes(idx)) {
                tile.classList.add('tile-merged');
            }

            container.appendChild(tile);
        }
    }

    gameHud.set({ score: score });

    // Highlight high score if new record
    const highScoreEl = document.getElementById('highScore');
    highScoreEl.textContent = highScore;
    const highScoreParent = highScoreEl.parentElement;
    if (score > 0 && score >= highScore) {
        highScoreParent.classList.add('new-record');
    } else {
        highScoreParent.classList.remove('new-record');
    }
}

function showScoreFloat(points) {
    // Se ancla a gameSide (no a #game2048): render() vacía el contenedor del
    // tablero en cada movimiento y borraría el flotante antes de terminar.
    const container = document.getElementById('gameSide') || document.getElementById('game2048');
    const el = document.createElement('div');
    el.className = 'score-float';
    el.textContent = '+' + points;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

function showWinBanner() {
    const container = document.getElementById('gameSide');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'win-banner';
    el.textContent = '¡2048 alcanzado!';
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

// Feedback de movimiento inválido: el tablero se sacude, sin gastar turno.
function shakeBoard() {
    const el = document.getElementById('game2048');
    el.classList.remove('board-shake');
    void el.offsetWidth;               // fuerza reflow para reiniciar la animación
    el.classList.add('board-shake');
}

function move(dir) {
    let moved = false;
    let pointsGained = 0;
    newCells = [];
    mergedCells = [];

    // Compacta una línea y fusiona pares adyacentes, construyendo la línea de
    // salida sobre la marcha y saltando la ficha consumida (i++).
    // El tablero y los puntos resultantes son los mismos que antes; lo que se
    // corrige es el ÍNDICE de la animación de fusión. `out.length - 1` es la
    // posición FINAL de la ficha fusionada, mientras que el índice antiguo `i`
    // era la posición previa a compactar: con dos fusiones en la misma línea
    // ([2,2,2,2] -> [4,4]) se marcaba la celda 2, que queda vacía, en vez de la 1.
    function slide(line, lineIndex, isRow, reversed) {
        const arr = line.filter(v => v);
        const out = [];
        for (let i = 0; i < arr.length; i++) {
            if (i + 1 < arr.length && arr[i] === arr[i + 1]) {
                const val = arr[i] * 2;
                out.push(val);
                pointsGained += val;
                score += val;
                const pos = out.length - 1;
                const at = reversed ? SIZE - 1 - pos : pos;
                mergedCells.push(isRow ? lineIndex * SIZE + at : at * SIZE + lineIndex);
                i++;                    // la segunda ficha del par queda consumida
            } else {
                out.push(arr[i]);
            }
        }
        while (out.length < SIZE) out.push(0);
        return out;
    }

    if (dir === 'left') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide(board[r], r, true, false);
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'right') {
        for (let r = 0; r < SIZE; r++) {
            let old = [...board[r]];
            board[r] = slide([...board[r]].reverse(), r, true, true).reverse();
            if (board[r].toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'up') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide(col, c, false, false);
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }
    if (dir === 'down') {
        for (let c = 0; c < SIZE; c++) {
            let col = board.map(row => row[c]);
            let old = [...col];
            col = slide([...col].reverse(), c, false, true).reverse();
            for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
            if (col.toString() !== old.toString()) moved = true;
        }
    }

    if (moved) {
        addTile();
        render();
        if (pointsGained > 0) {
            showScoreFloat(pointsGained);
            GameAudio.merge();
        } else {
            GameAudio.slide();
        }
        if (score > highScore) {
            highScore = score;
            GameStore.set('2048HighScore', highScore);
        }
        // Check for 2048 tile win
        let has2048 = false;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] >= 2048) has2048 = true;
        if (has2048 && !winPlayed) { winPlayed = true; GameAudio.win(); showWinBanner(); }
        if (isGameOver()) gameOver();
    } else {
        shakeBoard();
    }
}

function isGameOver() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] === 0) return false;
            if (c < SIZE-1 && board[r][c] === board[r][c+1]) return false;
            if (r < SIZE-1 && board[r][c] === board[r+1][c]) return false;
        }
    }
    return true;
}

function startGame() {
    score = 0;
    winPlayed = false;
    document.getElementById('gameOverPopup').style.display = 'none';
    createBoard();
    GameAudio.start();
    isPlaying = true;
    gameControls.running();
}

function restartGame() {
    startGame();
}

function gameOver() {
    isPlaying = false;
    GameAudio.gameOver();
    const popup = document.getElementById('gameOverPopup');
    // Reset animation by removing and re-adding
    popup.style.display = 'none';
    // Force reflow then show
    void popup.offsetWidth;
    popup.style.display = 'flex';
    document.getElementById('finalScore').textContent = 'Puntaje: ' + score;
    gameControls.idle();
}

var gameControls = GU.controls({ start: startGame, restart: restartGame, playAgain: startGame, popup: 'gameOverPopup' });

// Controles táctiles
document.getElementById('btnUp').addEventListener('click', () => isPlaying && move('up'));
document.getElementById('btnDown').addEventListener('click', () => isPlaying && move('down'));
document.getElementById('btnLeft').addEventListener('click', () => isPlaying && move('left'));
document.getElementById('btnRight').addEventListener('click', () => isPlaying && move('right'));

// Soporte para Swipe (mínimo 30px)
let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;

// Zona de gestos: todo el gameSide, no sólo la rejilla — en móvil el tablero
// ocupa una fracción de la pantalla y los swipes fuera de él se perdían.
const gestureZone = document.getElementById('gameSide') || document.getElementById('game2048');

gestureZone.addEventListener('touchstart', function(event) {
    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
    touchendX = touchstartX;
    touchendY = touchstartY;
}, { passive: true });

// Evita el scroll/bounce de la página mientras se desliza sobre el tablero.
gestureZone.addEventListener('touchmove', function(event) {
    if (isPlaying) event.preventDefault();
}, { passive: false });

gestureZone.addEventListener('touchend', function(event) {
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    handleGesture();
}, false);

function handleGesture() {
    if (!isPlaying) return;
    let dx = touchendX - touchstartX;
    let dy = touchendY - touchstartY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
            if (dx > 0) move('right');
            else move('left');
        }
    } else {
        if (Math.abs(dy) > 30) {
            if (dy > 0) move('down');
            else move('up');
        }
    }
}

window.addEventListener('keydown', e => {
    if (!isPlaying) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') move('left');
        if (e.key === 'ArrowRight') move('right');
        if (e.key === 'ArrowUp') move('up');
        if (e.key === 'ArrowDown') move('down');
    }
});

// Initial display
gameHud.set({ score: score });
highScoreEl.textContent = highScore;
render();

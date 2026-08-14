// Puzzle Deslizante (Sliding Puzzle) - Enhanced
var SIZE = 4;
var tiles = []; // 1D logical array, 0 = empty
var isPlaying = false;
var moves = 0;
var timerInterval = null;
var elapsed = 0;
var hintsLeft = 3;

// Records per size: { time, moves }
function getRecord(size) {
    return GameStore.getJSON('slidingRecord_' + size, null);
}
function setRecord(size, time, mvs) {
    GameStore.setJSON('slidingRecord_' + size, { time: time, moves: mvs });
}

// ===================== GOAL / SOLVE CHECK =====================
function goalState() {
    var g = [];
    for (var i = 1; i < SIZE * SIZE; i++) g.push(i);
    g.push(0);
    return g;
}

function isSolved() {
    var goal = goalState();
    for (var i = 0; i < tiles.length; i++) if (tiles[i] !== goal[i]) return false;
    return true;
}

// ===================== SHUFFLE =====================
function shuffleTiles(arr) {
    var a = arr.slice();
    var emptyIdx = a.indexOf(0);
    for (var i = 0; i < 1000; i++) {
        var row = Math.floor(emptyIdx / SIZE);
        var col = emptyIdx % SIZE;
        var neighbors = [];
        if (row > 0) neighbors.push(emptyIdx - SIZE);
        if (row < SIZE - 1) neighbors.push(emptyIdx + SIZE);
        if (col > 0) neighbors.push(emptyIdx - 1);
        if (col < SIZE - 1) neighbors.push(emptyIdx + 1);
        var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        a[emptyIdx] = a[pick];
        a[pick] = 0;
        emptyIdx = pick;
    }
    return a;
}

// ===================== RENDER =====================
function renderBoard() {
    var container = document.getElementById('puzzleBoard');
    container.innerHTML = '';
    // Remove solved overlay if present
    var oldOverlay = container.querySelector('.solved-overlay');
    if (oldOverlay) oldOverlay.remove();

    // Set grid columns/rows dynamically
    container.style.gridTemplateColumns = 'repeat(' + SIZE + ', 1fr)';
    container.style.gridTemplateRows    = 'repeat(' + SIZE + ', 1fr)';

    var emptyIdx = tiles.indexOf(0);

    for (var i = 0; i < tiles.length; i++) {
        var tile = document.createElement('div');
        var val = tiles[i];
        tile.className = 'puzzle-tile' + (val === 0 ? ' empty' : '');
        tile.textContent = val === 0 ? '' : val;
        if (val !== 0) {
            tile.dataset.index = i;
            tile.dataset.val   = val;
            // Highlight movable tiles
            if (isMovable(i, emptyIdx)) tile.classList.add('movable');
            tile.addEventListener('click', onTileClick);
            tile.addEventListener('touchstart', function(e) {
                e.preventDefault();
                onTileClick.call(this, e);
            }, { passive: false });
        }
        container.appendChild(tile);
    }

    // Adjust font size for smaller boards
    var tileEls = container.querySelectorAll('.puzzle-tile:not(.empty)');
    tileEls.forEach(function(t) {
        t.style.fontSize = SIZE === 3 ? '2.5rem' : SIZE === 5 ? '1.4rem' : '2rem';
    });
}

function isMovable(idx, emptyIdx) {
    var row  = Math.floor(idx / SIZE),     col  = idx % SIZE;
    var eRow = Math.floor(emptyIdx / SIZE), eCol = emptyIdx % SIZE;
    return (Math.abs(row - eRow) === 1 && col === eCol) ||
           (Math.abs(col - eCol) === 1 && row === eRow);
}

// ===================== TILE CLICK =====================
function onTileClick() {
    if (!isPlaying) return;
    var idx = parseInt(this.dataset.index);
    var emptyIdx = tiles.indexOf(0);
    if (!isMovable(idx, emptyIdx)) return;

    // Swap
    tiles[emptyIdx] = tiles[idx];
    tiles[idx] = 0;
    moves++;
    GameAudio.slide();
    renderBoard();
    animateMovesCounter();
    updateHUD();
    if (isSolved()) win();
}

// ===================== KEYBOARD =====================
document.addEventListener('keydown', function(e) {
    if (!isPlaying) return;
    var emptyIdx = tiles.indexOf(0);
    var eRow = Math.floor(emptyIdx / SIZE), eCol = emptyIdx % SIZE;
    var swap = -1;
    if (e.key === 'ArrowUp'    && eRow < SIZE - 1) swap = emptyIdx + SIZE;
    if (e.key === 'ArrowDown'  && eRow > 0)        swap = emptyIdx - SIZE;
    if (e.key === 'ArrowLeft'  && eCol < SIZE - 1) swap = emptyIdx + 1;
    if (e.key === 'ArrowRight' && eCol > 0)        swap = emptyIdx - 1;
    if (swap >= 0) {
        e.preventDefault();
        tiles[emptyIdx] = tiles[swap];
        tiles[swap] = 0;
        moves++;
        GameAudio.slide();
        renderBoard();
        animateMovesCounter();
        updateHUD();
        if (isSolved()) win();
    }
});

// ===================== MOVES COUNTER BOUNCE =====================
function animateMovesCounter() {
    var el = document.getElementById('moves');
    el.classList.remove('bounce');
    void el.offsetWidth;
    el.classList.add('bounce');
    setTimeout(function() { el.classList.remove('bounce'); }, 300);
}

// ===================== FORMAT TIME =====================
function formatTime(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ===================== HUD =====================
/* El reloj se sigue ya formateado: `elapsed` en crudo cambia en cada frame y
 * dejaría el filtro sin efecto. */
var gameHud = GU.hud({
    moves: 'moves',
    timer: 'timer',
    best:  'highScore',
    mobile: { el: 'mobileScore', format: function () {
        return moves + ' mov | ' + formatTime(elapsed);
    } }
});

function updateHUD() {
    var rec = getRecord(SIZE);
    gameHud.set({
        moves: moves,
        timer: formatTime(elapsed),
        best:  rec ? formatTime(rec.time) + ' / ' + rec.moves + ' mov' : '--'
    });
    updateRecordsPanel();
    // Hints
    var hintBtn = document.getElementById('hintBtn');
    if (hintBtn) hintBtn.textContent = 'Pista (' + hintsLeft + ')';
}

// ===================== WIN =====================
function win() {
    isPlaying = false;
    GameAudio.win();
    clearInterval(timerInterval);

    var rec = getRecord(SIZE);
    var isNewRecord = !rec || elapsed < rec.time || (elapsed === rec.time && moves < rec.moves);
    if (isNewRecord) setRecord(SIZE, elapsed, moves);

    updateHUD();

    // Wave animation on all tiles
    var allTiles = document.querySelectorAll('.puzzle-tile:not(.empty)');
    allTiles.forEach(function(t, i) {
        setTimeout(function() {
            t.classList.add('wave');
        }, i * 40);
    });

    // Solved overlay on board
    setTimeout(function() {
        var board = document.getElementById('puzzleBoard');
        var overlay = document.createElement('div');
        overlay.className = 'solved-overlay';
        overlay.innerHTML = '<div class="solved-text">¡Resuelto!<br>' +
            '<span style="font-size:1rem;background:none;-webkit-text-fill-color:#8fd3f4;color:#8fd3f4">' +
            formatTime(elapsed) + ' · ' + moves + ' mov' +
            (isNewRecord ? '<br>¡Nuevo récord! 🏆' : '') +
            '</span></div>';
        board.appendChild(overlay);
    }, allTiles.length * 40 + 200);

    setTimeout(function() {
        document.getElementById('finalScore').textContent =
            moves + ' movimientos en ' + formatTime(elapsed) +
            (isNewRecord ? ' ¡Nuevo récord!' : '');
        document.getElementById('gameOverPopup').style.display = 'flex';
    }, allTiles.length * 40 + 900);

    gameControls.idle();
    var hintBtn = document.getElementById('hintBtn');
    if (hintBtn) hintBtn.disabled = true;
}

// ===================== HINT =====================
function useHint() {
    if (!isPlaying || hintsLeft <= 0) return;
    // Find the tile closest to its goal position
    var goal = goalState();
    var emptyIdx = tiles.indexOf(0);
    var bestIdx = -1;
    var bestScore = Infinity;
    for (var i = 0; i < tiles.length; i++) {
        if (tiles[i] === 0) continue;
        if (!isMovable(i, emptyIdx)) continue;
        // Manhattan distance of this tile from its goal
        var goalPos = goal.indexOf(tiles[i]);
        var curRow = Math.floor(i / SIZE), curCol = i % SIZE;
        var goalRow = Math.floor(goalPos / SIZE), goalCol = goalPos % SIZE;
        var dist = Math.abs(curRow - goalRow) + Math.abs(curCol - goalCol);
        if (dist < bestScore) {
            bestScore = dist;
            bestIdx = i;
        }
    }
    if (bestIdx === -1) {
        // If no movable tile is clearly out of place, just pick a random movable
        for (var i = 0; i < tiles.length; i++) {
            if (tiles[i] !== 0 && isMovable(i, emptyIdx)) { bestIdx = i; break; }
        }
    }
    if (bestIdx === -1) return;

    // Highlight the hint tile
    var tileEl = document.querySelector('.puzzle-tile[data-index="' + bestIdx + '"]');
    if (tileEl) {
        tileEl.classList.add('hint');
        setTimeout(function() { tileEl.classList.remove('hint'); }, 2000);
    }
    hintsLeft--;
    updateHUD();
    var hintBtn = document.getElementById('hintBtn');
    if (hintBtn && hintsLeft <= 0) hintBtn.disabled = true;
}

// ===================== SIZE SELECTOR =====================
function injectSizeSelector() {
    var gameSide = document.getElementById('gameSide');
    if (!gameSide) return;

    var wrap = document.createElement('div');
    wrap.className = 'size-selector';
    [3, 4, 5].forEach(function(s) {
        var btn = document.createElement('button');
        btn.className = 'size-btn' + (s === SIZE ? ' active' : '');
        btn.textContent = s + 'x' + s;
        btn.dataset.size = s;
        btn.id = 'sizeBtn' + s;
        btn.addEventListener('click', function() {
            var newSize = parseInt(this.dataset.size);
            if (newSize === SIZE) return;
            SIZE = newSize;
            document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            if (isPlaying) {
                startGame();
            } else {
                tiles = goalState();
                renderBoard();
                updateHUD();
            }
        });
        wrap.appendChild(btn);
    });

    var board = document.getElementById('puzzleBoard');
    gameSide.insertBefore(wrap, board);
}

// ===================== HINT BUTTON =====================
function injectHintButton() {
    var buttonsPanel = document.querySelector('.buttons-panel');
    if (!buttonsPanel) return;
    var btn = document.createElement('button');
    btn.id = 'hintBtn';
    btn.textContent = 'Pista (3)';
    btn.disabled = true;
    btn.addEventListener('click', useHint);
    buttonsPanel.appendChild(btn);
}

// ===================== RECORDS PANEL =====================
function injectRecordsPanel() {
    var infoSide = document.getElementById('infoSide');
    if (!infoSide) return;
    var panel = document.createElement('div');
    panel.className = 'records-panel';
    panel.id = 'recordsPanel';
    panel.innerHTML = '<h3>Mejores tiempos</h3><div id="recordsContent"></div>';
    infoSide.appendChild(panel);
}

function updateRecordsPanel() {
    var content = document.getElementById('recordsContent');
    if (!content) return;
    content.innerHTML = '';
    [3, 4, 5].forEach(function(s) {
        var rec = getRecord(s);
        var row = document.createElement('div');
        row.className = 'record-row';
        row.innerHTML =
            '<span class="rec-label">' + s + 'x' + s + '</span>' +
            '<span class="rec-val">' + (rec ? formatTime(rec.time) + ' / ' + rec.moves + ' mov' : '--') + '</span>';
        content.appendChild(row);
    });
}

// ===================== START =====================
function startGame() {
    GameAudio.start();
    tiles = shuffleTiles(goalState());
    moves = 0; elapsed = 0; isPlaying = true;
    hintsLeft = 3;
    clearInterval(timerInterval);
    timerInterval = setInterval(function() { elapsed++; updateHUD(); }, 1000);
    renderBoard();
    updateHUD();
    document.getElementById('gameOverPopup').style.display = 'none';
    gameControls.running();
    var hintBtn = document.getElementById('hintBtn');
    if (hintBtn) { hintBtn.disabled = false; hintBtn.textContent = 'Pista (3)'; }
}

// ===================== INIT =====================
var gameControls = GU.controls({ start: startGame, popup: 'gameOverPopup' });

injectSizeSelector();
injectHintButton();
injectRecordsPanel();

tiles = goalState();
renderBoard();
updateHUD();

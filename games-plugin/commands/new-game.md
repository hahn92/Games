---
description: Scaffold a complete new game from the project template. Pass the folder name in lowercase (e.g. "platformer", "pinball").
---

# New Game — "$ARGUMENTS"

Scaffold a new game called **"$ARGUMENTS"** in `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/` following every project convention.

## 1 — Create files

Create these four files:

### `$ARGUMENTS/styles.css`
Must start with:
```css
@import url('../styles.css');
```
Then add game-specific styles following the pattern in `runner/styles.css`.

### `$ARGUMENTS/index.html`
Use `runner/index.html` as base template. Required elements:
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
- `#gameSide`, `#infoSide`, `#mobileScore`, `#mobileStartBtn`, `#gameOverPopup`, `#playAgainBtn`
- `adjustMobileLayout()` using `window.innerWidth + 'px'` (never `'100vw'`) and height offset ≤ 50px
- Script order at end of `<body>`:
  ```html
  <script src="../audio.js"></script>
  <script src="./main.js"></script>
  <script src="../fullscreen-btn.js"></script>
  ```

### `$ARGUMENTS/main.js`
Game logic with this skeleton:

```js
/* ── State ─────────────────────────────── */
var score = 0;
var highScore = parseInt(localStorage.getItem('$ARGUMENTSHigh') || '0', 10);
var isPlaying = false;

/* ── Game loop ──────────────────────────── */
var lastTime = 0;
function loop(ts) {
    var dt = ts - lastTime;
    if (dt < 15) { requestAnimationFrame(loop); return; }
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

function startGame() {
    score = 0;
    isPlaying = true;
    GameAudio.start();
    GameAudio.click();
    requestAnimationFrame(loop);
}

function endGame() {
    isPlaying = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('$ARGUMENTSHigh', highScore);
    }
    GameAudio.gameOver();
    document.getElementById('gameOverPopup').style.display = 'flex';
}

/* ── Buttons ────────────────────────────── */
document.getElementById('startBtn').addEventListener('click', function () {
    GameAudio.click();
    startGame();
});
document.getElementById('restartBtn').addEventListener('click', function () {
    GameAudio.click();
    startGame();
});
document.getElementById('playAgainBtn').addEventListener('click', function () {
    GameAudio.click();
    document.getElementById('gameOverPopup').style.display = 'none';
    startGame();
});
```

### `$ARGUMENTS/image.png`
Leave a placeholder — the user will provide the thumbnail image separately. Create a note file `$ARGUMENTS/image-pending.txt` with content `thumbnail pending`.

## 2 — Add to catalog

Add a card in the root `index.html` inside `.games-grid` (keep alphabetical or by category):

```html
<div class="game-card">
    <img src="./$ARGUMENTS/image.png" alt="Captura del juego"
         onerror="this.style.background='#2a2a2a';this.removeAttribute('onerror')">
    <div class="game-info">
        <div class="game-title">TITLE_HERE</div>
        <div class="game-category">CATEGORY_HERE</div>
        <p class="game-desc">DESCRIPTION_HERE</p>
        <a href="./$ARGUMENTS/" class="game-link">Jugar</a>
    </div>
</div>
```

## 3 — Update CLAUDE.md

Add the game to the Complete game list table in `CLAUDE.md`.

## 4 — Validate

Once the game logic is implemented, run:
```
/games:validate-game $ARGUMENTS
```

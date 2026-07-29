---
description: Scaffold a complete new game from the project template. Pass the folder name in lowercase (e.g. "platformer", "pinball").
---

# New Game — "$ARGUMENTS"

Scaffold a new game called **"$ARGUMENTS"** in `/Users/hahn/Documents/Repository/Web/Games/$ARGUMENTS/` following every project convention.

## 1 — Create files

Create these three files:

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

## 2 — Add thumbnail to `thumbnails.js`

Open `/Users/hahn/Documents/Repository/Web/Games/thumbnails.js` and add a drawing function
for `$ARGUMENTS` inside the `thumbs` object, before the closing `};`.

Draw a recognisable mini-scene for the game using Canvas 2D API primitives only — no images,
no emoji on canvas. The canvas is 220×220. Use the shared `C` palette (C.bg, C.blue,
C.orange, C.green, C.white, etc.) and helper functions (`background`, `gradBg`, `roundRect`).

Insert right before the closing `};` of the `thumbs` object:

```js
    $ARGUMENTS: function (ctx) {
        // A recognisable mini-scene for the game.
        background(ctx);
        // … drawing code using ctx.arc, ctx.fillRect, ctx.beginPath, etc. …
    },
```

Ensure the previous entry in `thumbs` has a trailing comma.

## 3 — Add to catalog

Add a card in the root `index.html` inside `.games-grid` (keep alphabetical or by category).
Use `<canvas data-game="...">` — no `<img>` tags, thumbnails are rendered by `thumbnails.js`:

```html
<div class="game-card">
    <canvas data-game="$ARGUMENTS"></canvas>
    <div class="game-info">
        <div class="game-title">TITLE_HERE</div>
        <div class="game-category">CATEGORY_HERE</div>
        <p class="game-desc">DESCRIPTION_HERE</p>
        <a href="./$ARGUMENTS/" class="game-link">Jugar</a>
    </div>
</div>
```

## 4 — Update CLAUDE.md

Add the game to the Complete game list table in `CLAUDE.md`.

## 5 — Validate

Once the game logic is implemented, run:
```
/games:validate-game $ARGUMENTS
```

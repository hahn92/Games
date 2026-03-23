---
description: Scaffold a new game from the standard template. Pass the folder name (lowercase, no spaces) as the argument.
---

# New Game — "$ARGUMENTS"

Create a new game called **"$ARGUMENTS"** following the project conventions.

## Steps

### 1. Create the folder and files

Create `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/` with:

- `styles.css` — starting with `@import url('../styles.css');` then game-specific styles
- `index.html` — use `runner/index.html` as the base template
- `main.js` — game logic skeleton

### 2. `index.html` template

Use `runner/index.html` as the base. Key requirements:

- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
- `adjustMobileLayout()` with `window.innerWidth + 'px'` for width, ≤ 50px height offset
- Script order at end of `<body>`: `audio.js` → `main.js` → `fullscreen-btn.js`
- `#mobileScore`, `#mobileStartBtn`, `#gameSide`, `#infoSide` elements present
- `#gameOverPopup` with `#playAgainBtn`

### 3. `main.js` skeleton

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

### 4. Add thumbnail to `thumbnails.js`

Open `/Users/hahn/Documents/Desarrollo/Games/thumbnails.js` and add a drawing function
for `$ARGUMENTS` inside the `thumbs` object, before the closing `};`. Draw a recognisable
mini-scene for the game using Canvas 2D primitives — no images, no emoji.

Pattern to follow (add right before the closing `};` of the `thumbs` object):

```js
    $ARGUMENTS: function (ctx) {
        // Draw a recognisable scene for the game.
        // Use the shared palette in C (C.bg, C.blue, C.orange, C.green, C.white…).
        // Canvas is 220×220. Keep it simple and iconic.
        background(ctx);
        // … your drawing code …
    },
```

After inserting the function, verify the comma after the previous function's closing `}` is present.

### 5. Add to the catalog

Add a card in `/Users/hahn/Documents/Desarrollo/Games/index.html` inside `.games-grid`:

```html
<div class="game-card">
    <canvas data-game="$ARGUMENTS"></canvas>
    <div class="game-info">
        <div class="game-title">TITLE</div>
        <div class="game-category">CATEGORY</div>
        <p class="game-desc">DESCRIPTION</p>
        <a href="./$ARGUMENTS/" class="game-link">Jugar</a>
    </div>
</div>
```

### 6. Update CLAUDE.md

Add the game to the Complete game list table in `CLAUDE.md`.

### 7. Validate

Run `/validate-game $ARGUMENTS` once the game logic is complete.

---
description: Scaffold a new game from the standard template. Pass the folder name (lowercase, no spaces) as the argument.
---

# New Game — "$ARGUMENTS"

Create a new game called **"$ARGUMENTS"** following the project conventions.

## Steps

### 1. Create the folder and files

Create `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/` with:

- `styles.css` — starting with `@import url('../styles.css');` then game-specific styles
- `index.html` — use the template below
- `main.js` — game logic skeleton
- (The user will provide or generate `image.png` separately)

### 2. `index.html` template

Use `runner/index.html` as the base. Key requirements:

- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
- `adjustMobileLayout()` with `window.innerWidth + 'px'` for width, ≤ 50px height offset
- Script order: `audio.js` → `main.js` → `fullscreen-btn.js`
- `#mobileScore`, `#mobileStartBtn`, `#gameSide`, `#infoSide` elements present
- `#gameOverPopup` with `#playAgainBtn`

### 3. `main.js` skeleton

Include:

```js
// Key GameAudio hooks — fill in at the right trigger points:
// GameAudio.start()     → on startGame()
// GameAudio.gameOver()  → on game over
// GameAudio.score()     → on scoring
// GameAudio.click()     → on button clicks
```

Use `requestAnimationFrame` for the game loop with a `dt` throttle:

```js
var lastTime = 0;
function loop(ts) {
    var dt = ts - lastTime;
    if (dt < 15) { requestAnimationFrame(loop); return; }
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}
```

Save high scores to `localStorage`.

### 4. Add to the catalog

Add a card entry in `/Users/hahn/Documents/Desarrollo/Games/index.html`:

```html
<div class="game-card">
    <img src="./$ARGUMENTS/image.png" alt="Captura del juego"
         onerror="this.style.background='#2a2a2a';this.removeAttribute('onerror')">
    <div class="game-info">
        <div class="game-title">TITLE</div>
        <div class="game-category">CATEGORY</div>
        <p class="game-desc">DESCRIPTION</p>
        <a href="./$ARGUMENTS/" class="game-link">Jugar</a>
    </div>
</div>
```

### 5. Validate

Run `/validate-game $ARGUMENTS` once the game logic is complete.

---
description: Validate a game against all quality criteria — sound, graphics, mobile layout, touch controls, and code quality. Pass a game folder name or leave blank to check all 54 games.
---

# Validate Game — "$ARGUMENTS"

Read `$ARGUMENTS/index.html`, `$ARGUMENTS/main.js`, and `$ARGUMENTS/styles.css` (or all games if blank), then evaluate every criterion below.

## 🔊 Sound

- `<script src="../audio.js">` present in `index.html` before `main.js`
- `GameAudio.start()` called when game begins
- `GameAudio.gameOver()` called on game over
- `GameAudio.score()` or equivalent called on scoring
- `GameAudio.click()` in `startBtn`, `restartBtn`, and `playAgainBtn` handlers
- At least 2 game-specific sounds (jump, hit, explode, flip, etc.)

## 🖼️ Thumbnail

- `thumbnails.js` contains a `"$ARGUMENTS"` key inside the `thumbs` object
- The root `index.html` has `<canvas data-game="$ARGUMENTS">` (not an `<img>`) for this game

## 🎨 Graphics

- No emoji inside `ctx.fillText()` on canvas
- `requestAnimationFrame` used for game loop (not `setInterval` alone)
- `ctx.shadowBlur` NOT set inside loops iterating over many elements
- Game elements drawn with canvas primitives (`arc`, `rect`, paths, bezier curves)

## 📱 Mobile

- `adjustMobileLayout()` present in `index.html`
- `window.innerWidth + 'px'` used for `gameSide` width (not `'100vw'`)
- Canvas height offset ≤ 60px
- `<script src="../fullscreen-btn.js">` in `index.html`
- `#mobileScore` updated with current stats

## 👆 Touch

- Canvas games have `touchstart`/`touchend` on the canvas element
- No gameplay dependency on `.touch-controls` (hidden globally via CSS `!important`)
- Touch coordinates scaled if `canvas.style.width ≠ canvas.width`

## ⚡ Code Quality

- `localStorage` used for persistent high score / stats
- `startGame()` resets all state
- No `Math.random()` inside draw/render functions
- Delta-time throttle: `if (dt < 15) return;` (or equivalent) in rAF loop

## Output

For each criterion: ✅ PASS or ❌ FAIL with a one-line explanation.
End with a **Required Fixes** list sorted by severity (blocking → cosmetic).

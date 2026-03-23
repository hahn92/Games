---
description: Validate a game against all quality criteria (sound, graphics, mobile, touch, code quality). Pass a game name or leave blank to validate all 20 games.
---

# Validate Game

Use the `game-validator` subagent to validate the game **"$ARGUMENTS"** (or all games if no argument given) against every quality criterion in this project.

Read `$ARGUMENTS/index.html`, `$ARGUMENTS/main.js`, and `$ARGUMENTS/styles.css`, then check each section:

## 🔊 Sound

- `<script src="../audio.js">` present in `index.html` before `main.js`
- `GameAudio.start()` called when game begins
- `GameAudio.gameOver()` called on game over
- `GameAudio.score()` or equivalent called when player scores
- `GameAudio.click()` called in `startBtn`, `restartBtn`, and `playAgainBtn` handlers
- At least 2 game-specific sounds beyond the basics (jump, hit, explode, etc.)

## 🎨 Graphics

- No emoji inside `ctx.fillText()` on canvas
- `requestAnimationFrame` used for game loop (not `setInterval` alone)
- `ctx.shadowBlur` NOT set inside any loop that iterates over many elements
- Game elements drawn with canvas primitives (`arc`, `rect`, `bezierCurveTo`, paths)

## 📱 Mobile

- `adjustMobileLayout()` present in `index.html`
- Uses `window.innerWidth + 'px'` (NOT `'100vw'`) for `gameSide` width
- Canvas height offset is ≤ 60px
- `<script src="../fullscreen-btn.js">` present in `index.html`
- `#mobileScore` div updated with relevant stats

## 👆 Touch

- Canvas games have `touchstart`/`touchend` listeners on the canvas element
- No gameplay dependency on `.touch-controls` buttons (globally hidden via CSS)
- Touch coordinates scaled correctly if `canvas.style.width ≠ canvas.width`

## ⚡ Code Quality

- `localStorage` used for high scores / persistent stats
- `startGame()` resets all game state
- No `Math.random()` inside render/draw functions
- Delta-time throttle in rAF loop (`if (dt < 15) return;` or similar)

## Output format

For each criterion: ✅ PASS or ❌ FAIL with a brief reason. End with a **Required Fixes** list ordered by severity.

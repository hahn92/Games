---
description: Audit mobile layout, canvas scaling, fullscreen button, and touch handling for a game or all games.
---

# Check Mobile — "$ARGUMENTS"

Audit the mobile experience of **"$ARGUMENTS"** (or all games if blank) in `/Users/hahn/Documents/Repository/Web/Games/`.

Read `index.html` and `main.js` for each game, then verify:

## Viewport & gameSide

- `adjustMobileLayout()` exists in `index.html`
- `gameSide` width: `window.innerWidth + 'px'` — NOT `'100vw'`
- `gameSide` height: `visualViewport.height` — NOT `window.innerHeight`
- `gameSide.overflowX = 'hidden'` set to clip accidental overflow

## Canvas scaling (canvas games)

- Canvas scaled via `style.width/style.height`, not by mutating `canvas.width/canvas.height` at runtime
- Height offset ≤ 60px — no large space reserved for hidden touch buttons
- Touch coordinate scaling applied if `canvas.style.width ≠ canvas.width`:
  `touchX = (e.touches[0].clientX - rect.left) * (canvas.width / canvas.offsetWidth)`

## Fullscreen button

- `<script src="../fullscreen-btn.js">` present in `index.html`
- No `z-index` conflict hiding the button (button uses `z-index: 2001`)

## mobileScore overlay

- `#mobileScore` updated with the game's key stats
- Positioned with both `left: 5px` and `right: 5px` (prevents iOS Safari overflow)

## Touch gestures

- Canvas games: `touchstart`/`touchend` (+ `touchmove` if needed) on the `<canvas>` element
- No broken references to `.touch-controls` for gameplay (hidden globally via CSS `!important`)
- `touch-action: manipulation` on all interactive buttons

## Output

For each game: ✅/❌ per criterion + a **Fixes Needed** list.
If checking all games, end with a priority-sorted summary table.

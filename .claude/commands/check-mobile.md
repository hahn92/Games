---
description: Audit mobile layout for a game or all games. Checks viewport, canvas scaling, fullscreen button, and touch handling. Pass a game name or leave blank for all games.
---

# Check Mobile — "$ARGUMENTS"

Audit the mobile layout of **"$ARGUMENTS"** (or all games if blank) in `/Users/hahn/Documents/Desarrollo/Games/`.

Read `index.html` and `main.js` for each game and verify:

## Viewport & gameSide

- `adjustMobileLayout()` exists in `index.html`
- `gameSide` width set with `window.innerWidth + 'px'` (not `'100vw'`)
- `gameSide` height set with `visualViewport.height` (not `window.innerHeight`)
- `gameSide.overflowX = 'hidden'` set to clip any accidental overflow

## Canvas scaling (canvas games only)

- Canvas scaled via `style.width/style.height`, preserving aspect ratio
- Height offset ≤ 60px (space reserved only for `#mobileScore`, not hidden touch buttons)
- Scaled size fills ≥ 70% of `min(window.innerWidth, vHeight)`
- Touch coordinate scaling: if `canvas.style.width ≠ canvas.width`, divide touch X/Y by `canvas.style.width / canvas.width`

## Fullscreen button

- `<script src="../fullscreen-btn.js">` present in `index.html`
- No conflicting `z-index` that would hide the button

## mobileScore

- `#mobileScore` updated with the game's key stats (score, lives, level, etc.)
- Positioned with `left: 5px; right: 5px` so it never overflows on narrow viewports

## Touch gestures

- Canvas games: `touchstart`/`touchend` (and `touchmove` if needed) on the canvas
- No broken references to `.touch-controls` or `.touch-cols` for gameplay logic
- `touch-action: manipulation` set on buttons

## Output

For each game: ✅ or ❌ per criterion, plus a **Fixes Needed** list. If checking all games, end with a summary table.

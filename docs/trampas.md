# Trampas conocidas

Tres formas de romper un juego que no dan error en consola. Las tres costaron
tiempo una vez.

## Critical: Never use emoji on canvas

**Emoji rendered via `ctx.fillText()` on canvas causes transparency/rendering bugs in some browsers.** Always draw game elements as canvas shapes. This applies to:
- Characters/sprites (dino, frog, bird, etc.) → draw with `ctx.arc`, `ctx.roundRect`, paths
- Fruit/food items → custom canvas shapes
- Hearts/lives indicators → draw with bezier curves
- Any game-critical visual

## A game can load cleanly and still never draw

`snake` shipped visually dead for weeks. `renderLoop` was defined and only ever
referenced from inside itself, so nothing started it. The one `draw()` at init did
not survive either: `MobileLayout`'s `reset` reassigns `canvas.width` right after,
which clears the canvas.

What made it hard to notice is that the **game logic kept running** on its
`rafInterval` tick — the score in the side panel advanced normally while the board
stayed black. It looks like a rendering glitch, not a dead game.

Nothing in the usual checks catches this: the page loads, the console is clean,
`GameUtils` and the canvas are present, and HiDPI applies. **Loading is not drawing.**

When touching a game's loop, confirm the render entry point is actually reached:

- `requestAnimationFrame(loop)` must appear somewhere *outside* `loop` itself —
  or the loop must be a named function expression handed straight to rAF, as in
  `requestAnimationFrame(function loop(ts) { ... })`, which chess and damas use.
  A grep for "loop referenced only inside itself" flags that second form as a
  false positive.
- The only reliable verification is looking at the canvas. Load the game in a
  visible iframe (offscreen iframes get their rAF throttled by Chrome, and a
  narrow one flips `MobileLayout` into its mobile branch), let a few frames run,
  and take a screenshot. Reading pixels back with `getImageData` from a parent
  frame is **not** trustworthy: it returned all-black for games that were plainly
  rendering on screen.

## Never call `adjustMobileLayout()` by hand

Several games register their own `resize` listener beside the one
`mobile-layout.js` installs, and they depend on running **after** it. `snake` is
the clearest case: `MobileLayout`'s `onMobile` reassigns `canvas.width` to fit the
viewport, and snake's own `syncCanvasLogicSize` then re-reads it into `canvasSize`
and rescales the snake and the fruit onto the new grid. Because `index.html` runs
before `main.js`, the listeners already fire in that order on a real resize.

Calling `adjustMobileLayout()` directly resizes the canvas without the second half
of that pair. Snake's logic then keeps using the old board size: the snake can walk
outside the visible canvas and fruit can spawn where it is unreachable — exactly
the failure `rescaleCoord` exists to prevent.

So when testing orientation changes, resize and **dispatch a real `resize` event**;
do not invoke the layout function yourself. Verified across all 40 canvas games,
portrait → landscape → portrait: nothing overflows, aspect ratios hold, every game
recovers its original size, and snake's grid stays consistent (box 9 → 8 with the
snake and fruit rescaled onto matching cells).

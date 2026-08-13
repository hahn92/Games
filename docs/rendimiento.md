# Rendimiento

Las reglas de esta página salen de trabajo de optimización real: cada una
corresponde a un cuello de botella que se midió.

## Catalog thumbnails

All 64 thumbnail canvases live in the DOM at once, but the catalog paginates by
toggling `display` on the cards, so only 8 are shown at a time. `thumbnails.js`
therefore draws each one lazily, through an `IntersectionObserver`: a hidden card
has no layout box and never intersects, and paginating or filtering to it gives it
one. Drawing all 64 up front spent ~85% of the work on canvases nobody could see —
and since they render at device pixel density, each is a 440x440 backing store.

Two consequences when touching this:

- A thumbnail is drawn **once**. The canvas keeps its pixels when the card is
  hidden again, so there is nothing to redraw on the way back.
- These canvases are sized from script, not from markup, so the automatic HiDPI
  pass skips them. `thumbnails.js` opts in with
  `GU.upgradeCanvas(canvas, { pinCss: false })` after setting width/height and
  before `getContext`. `pinCss: false` matters: the cards size the canvas with
  `width:100%` + `aspect-ratio:1/1`, and pinning an explicit height would win over
  that aspect ratio and squash the image.

## Canvas performance rules

These rules exist because past optimization work identified them as the biggest bottlenecks:

1. **Never use `ctx.shadowBlur` per-alien/per-element in a loop** — shadow compositing is the most expensive canvas operation. Reserve it for the player, bullets, and UI. Set it once before a batch, reset after.
2. **Batch draw state changes** — set `fillStyle`, `globalAlpha`, `shadowBlur` once before drawing a group of similar objects, not inside each iteration.
3. **Use `requestAnimationFrame` not `setInterval`** — rAF syncs with the monitor refresh rate. With rAF, throttle to 60fps via timestamp delta: `if (dt < 15) return;`
4. **Never call `ctx.save()/ctx.restore()` inside tight loops** — only use save/restore when you truly need to isolate a transform.
5. **No `Math.random()` in the render path** — pre-compute random values (particle offsets, jitter) when spawning, not while drawing.
6. **Stars and small particles: use `fillRect` not `arc`** — rectangle draws are faster than circle draws for small elements.
7. **Cache gradients** — `createLinearGradient`/`createRadialGradient` are expensive. Cache them and only rebuild when position changes.
8. **Pre-cache per-object data** — store color, pre-computed offsets, and other derived values on the object when spawning, not on every draw call.

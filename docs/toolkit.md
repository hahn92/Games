# Toolkit compartido — `game-utils.js`

Loaded by every game, after `audio.js` and before `main.js`. Everything is on the
`GameUtils` namespace (aliased `GU`); a handful of names are also flat globals
because games already called them unqualified.

**Do not re-implement any of these in a game.** Each one replaced a per-game copy.

| Group | API |
|-------|-----|
| Loop | `rafInterval(fn, ms)` / `rafClear(h)` — fixed-tick loop; `rafLoop(fn, minMs)` — free-running ~60fps loop, `fn(dt, ts)` with `dt` clamped so a backgrounded tab can't tunnel bodies through walls |
| Math | `clamp`\*, `lerp`\*, `GU.dist`, `GU.dist2`, `GU.rand`, `GU.randInt`, `GU.pick`, `GU.shuffle`, `GU.angleDelta`, `GU.easeOutQuad` / `easeInQuad` / `easeInOutQuad` |
| Collision | `GU.rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh)`, `GU.circlesOverlap(x1,y1,r1, x2,y2,r2)` |
| Color | `hexToRgb`\*, `shade(hex, ±d)`\* (additive), `GU.scaleColor(hex, f)` (multiplicative), `GU.rgba(hex, a)`, `GU.mixColor(a, b, t)` |
| Canvas | `pointerPos(canvas, e)`\* → `{x, y}` in canvas space; `GU.roundRectPath(ctx, x,y,w,h,r)`; `GU.gradientMemo()` |
| Storage | `GameStore.getNum/setNum/getJSON/setJSON/get/set/remove`\*, `GameStore.available` |
| Particles | `new Particles(max, {semiImplicit})`\* with `.burst(x, y, n, opts)`, `.add(x, y, vx, vy, opts)`, `.update(dt)`, `.draw(ctx)`, `.each(fn)`, `.clear()` |
| HiDPI | automatic; `GU.upgradeCanvas(canvas, {maxScale, pinCss})` for canvases sized at runtime |
| Accessibility | `GU.keyActivate(el, label)` — makes a non-`<button>` cell focusable and Enter/Space-operable; `GU.gridKeyboard(container, cols, selector)` — roving tabindex + arrow navigation over a board; `GU.wirePopups()` — automatic, turns the `.popup` overlays into announced dialogs |

\* also available as a flat global.

## Why these exist

- **`ctx.roundRect` polyfill** — installed automatically when the browser lacks it
  (Safari < 16.4). A dozen games call `ctx.roundRect()` directly; without the
  polyfill that throws and takes the whole render loop down on older iOS.
- **`pointerPos`** — every canvas game needs mouse/touch → canvas-space mapping,
  and it must divide by `rect.width`, not just subtract `rect.left`: `mobile-layout.js`
  resizes canvases via `style.width/height`, so the CSS box and the backing store differ.
  Handles `touches`, `changedTouches`, plain mouse events and bare `Touch` objects,
  and guards the divide on a zero-size (hidden) canvas.
- **`GameStore`** — `localStorage` *throws* rather than returning null when site data
  is blocked (Safari "Block All Cookies", sandboxed iframes). Games read their high
  score at module top level, so an unguarded access kills `main.js` before anything
  renders. Every accessor degrades to an in-memory map, so a session still keeps its
  score. `GameStore` never throws — do not wrap it in `try`/`catch`.
- **`Particles`** — pooled; dead particles are reused instead of being spliced out of
  an array each frame, and `draw()` batches `fillStyle` changes. `burst()` picks angles
  and speeds for you; `add()` takes an explicit velocity, for effects with a directional
  bias or a jittered origin. **`life` is in seconds**: porting a per-frame
  `life: 1, decay: d` loop means `life: 1 / (d * 60)`, which reproduces the lifetime and
  the linear alpha ramp exactly at 60fps. Use `alpha` when the old code started below
  full opacity (a `life: 0.8` peak becomes `alpha: 0.8`). `update()` moves before
  integrating gravity, matching the hand-rolled loops it replaced.
  `new Particles(max, {semiImplicit: true})` accelerates before moving, which is what
  the delta-time loops did; the default moves first, like the per-frame loops. Getting
  this backwards shifts a particle's path by a few pixels over its life.
  Currently used by: airhockey, batallanaval, billar, breakout, catapulta, dardos,
  hanoi, helicoidal, minero, misiles, platformer, pong, saltador, sopaletras, stacktower.
  The other particle systems stay hand-rolled on purpose — they draw rotated ellipses,
  hue-cycling sparks, trails or fragment shapes the shared pool does not render.
- **HiDPI** — applied automatically at load to every canvas **whose size is declared in
  the markup**. `canvas.width`/`height` keep reporting the LOGICAL size, so game logic,
  hit testing and `pointerPos()` are unaffected; only the backing store and a base
  `scale(dpr)` transform change. Capped at 2×. Opt a canvas out with `data-no-hidpi`.
  Because of this, **never assume `canvas.width` is the backing-store size** — and if a
  game ever needs to resize its canvas, assigning `canvas.width` still works and the base
  transform is reinstalled.
  A canvas sized from script instead (the catalog thumbnails) is skipped by the automatic
  pass — its real size is not known yet — and must call `GU.upgradeCanvas()` itself right
  after setting width/height and before `getContext()`. Pass `{pinCss: false}` when a
  stylesheet already sizes it: the CSS pin sets an explicit height, which would override
  an `aspect-ratio` that nothing else constrains and squash the element.
- **`keyActivate` / `gridKeyboard`** — several DOM games build their board out of
  plain `<div>`s with only a click listener, which made them unplayable without a
  mouse (WCAG 2.1.1, level A). `keyActivate` gives a cell what a real `<button>`
  would have: focus, a button role and Enter/Space. `gridKeyboard` then keeps only
  ONE cell in the tab order and moves with the arrows — without it a hard
  minesweeper board is 480 separate tab stops. Call `gridKeyboard` again after each
  render: these games rebuild their cells every move, and it re-seats the tabbable
  cell and restores focus to the square the player was on.
  Used by memorama, minesweeper, tictactoe and whackamole. A cell that overrides
  `outline` needs its own `:focus-visible` rule, as `.ttt-cell` does.
- **`wirePopups`** — runs on its own, no game calls it. The 45 end-of-game overlays
  are divs toggled with `display`, so a screen reader never learned the game had
  ended. It marks them as `alertdialog`, names them from their heading and moves
  focus into them when they appear. Careful with visibility checks here:
  `offsetParent` is null for `position: fixed`, which every one of these popups is.
- **`gradientMemo`** — gradients are among the more expensive 2D calls. Key on
  everything the gradient depends on, geometry and colour stops both, and make sure the
  key is BOUNDED: keying on a scrolling or animated coordinate leaks a gradient per
  frame. For per-object gradients that differ only by position, build at the origin and
  `ctx.translate()` instead (see `chess/drawBoard`).

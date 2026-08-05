# Arcade

Juegos de acción directa y reflejos sobre canvas.

## Runner (`runner/`)
- Dino is fully canvas-drawn (body, head, snout, eye with blink, tail, legs). **Do not use emoji for the character.**
- Animation system: `squishX/squishY` lerp for jump/land impact, `blinkTimer` for eye blink, tail with `Math.sin` bezier wave, dust particle array on jump/land/run
- Horizontal movement: player can move left/right within `PLAYER_MAX_X = 320`
- Death: `deathAngle` + `deathVY` spin-fall animation + `screenShake` (14 frames)
- Touch: tap = jump, hold left 38% of canvas > 130ms = move left

## Frogger (`frogger/`)
- Frog is canvas-drawn with `drawFrogShape(cx, cy, r, moving, pose)`. No emoji. It is built as ONE
  continuous bezier silhouette via `frogBodyPath()` (snout → cheeks → pinched waist → hips → rump),
  not stacked ellipses — keep it that way, the old ellipse pile read as a green blob
- Frog limbs: `drawHindLeg(s, e, ...)` / `drawFrontLeg(s, e, ...)` where `e` = 0 coiled … 1 extended.
  Hind legs are LONG and fold into a `Z` at rest; keep their lateral reach near the hip width
  (a wide reach reads as a skirt). Feet come from `drawWebbedFoot()` — narrow fan (~1.05 rad)
- `pose` = `{ ext, squash, stretch }`. `drawFrog()` drives `ext` from hop phase (out fast, tucked to
  land), `stretch` at take-off and `squash` from `landSquash`. Keep squash ≤ ~0.13 or landing splays sideways
- Eyes are domes only just proud of the head outline. Oversized eyes swamp the silhouette
- The cast shadow is drawn at the GROUND position (`shadowX/shadowY`), never the arced position, and
  shrinks with `hopLift` — that shadow is what sells the jump height, not the scale change
- Idle tongue flick on safe rows (5, 11) every ~300 frames. It must start AT the snout tip
  (`-frogR * 0.96`); starting further back draws a pink stripe across the head
- Log riding: `frogRidingX` tracks world X position as a float, updated each frame by `lane.speed * lane.dir`
- Turtles (rows 2 & 4): groups created by `makeTurtles()`; `turtleState(o)` cycles up → warn (blink) → down using `(frame + o.phase) % o.cycle`. Submerged turtles don't hold the frog (`getFrogOnLog` skips state `'down'`)
- Frog rotation: `frogAngle` lerps (shortest path) toward `frogTargetAngle` set per move direction; after `frogUprightTimer` idle frames it returns to face up (never stays tipped sideways)
- River jumps are straight: while mid-hop (`frogHop.t < duration`) there is NO log drift, death check, or goal check — all resolve on landing. Vertical river jumps preserve the exact pixel X; `frog.col` is re-derived from `frogRidingX` at jump time (it goes stale while riding)
- Input buffering: a key pressed in the last 6 frames of a hop is stored in `queuedMove` and executed when the hop ends
- Cars: seen from above — cast shadow, then wheels (BEFORE the body, so they peek past the flanks,
  never on top), tapered nose / squarer tail body path, an inset roof panel in a darker tint of the
  body colour, and glass ONLY as windscreen + rear window + side slits. A large translucent
  rectangle across the whole roof reads as a pale blob, not a car. `shade(hex, d)` tints the body colour
- Turtles: domed carapace with a rim ellipse and five central scutes. A full grid of plate lines is
  too busy at this size
- 5 lily-pad goal slots; all must be filled to advance wave
- Death animations via `triggerDeathAnim(cause)`: water = blue flash + expanding ripple rings + rising bubbles; car = squashed frog with splayed legs, X eyes and orbiting stars
- Hop animation: `frogHop` tween with parabolic arc; logs/turtles bob (`o.bob`) and the frog inherits the bob while riding
- Idle tongue flick on safe rows (5, 11) every ~300 frames

## Pacman (`pacman/`)
- Movement is **cell-target**, not free: pac and every ghost commit to a
  `targetRow/targetCol` one cell away and interpolate toward its centre. Turning is
  only possible ON a centre, which is why `nextDir` buffers a key pressed mid-corridor.
  The leftover `overshoot` is carried into the new direction, so a turn costs no speed.
- Three maze templates rotate by level, and **nine cells are hardcoded outside them**:
  pacman spawns at `(12,1)`, `POWER_CELLS` at the four corners `(1,1) (1,12) (12,1)
  (12,12)`, ghosts at `(6,6) (6,7) (7,6) (7,7)`. All nine are floor in all three
  templates — verified. A fourth maze must keep them walkable or the level starts
  inside a wall.
- Pellets are placed on **every** floor cell and the level only clears when all are
  eaten, so a floor cell walled off from the rest makes the level unwinnable.
- Only ghost 0 chases (`chaseDir`, greedy on squared distance); the rest move at
  random, and all switch to `fleeDir` while vulnerable. Ghost count is 2/3/4 by level.
- Ghosts never reverse unless the cell is a dead end (`valid` falls back to `all`).
- `respawnGhost` fires from a bare `setTimeout(3000)`, outside the rAF loop — it checks
  for `gameover` on entry because it can outlive the round.
- The maze border is solid: there is no tunnel wraparound.

## Bubbleshooter (`bubbleshooter/`)
- `parityBase` is the whole trick. Rows alternate a half-bubble offset, so inserting a
  row at the top would flip every existing row's parity and slide the entire board
  sideways. `addNewRow` flips `parityBase` to cancel that, and `effParity(row)` is what
  every offset, neighbour and hit test reads — never the raw row index.
- Neighbours are hex, six of them, and their column depends on parity
  (`getNeighbors`). Getting this wrong breaks the flood fill silently: bubbles pop in
  the wrong clusters rather than throwing.
- The shot is substepped at ≤6px per step so it cannot tunnel between grid bubbles.
- The next colour comes from `randomColorFromGrid()` — one still present on the board,
  so the cannon can never hand you a colour that is impossible to match.
- Bubbles are **pre-rendered once per colour into offscreen canvases**. Drawing them
  as live radial gradients was a gradient per bubble per frame.

## Fruit Catcher (`fruitcatcher/`)
- All 10 fruit types + bomb drawn as custom canvas shapes. **No emoji.**
- Items spin as they fall (`rot` + `rotSpeed` per item)
- Lives drawn as custom canvas hearts

## Snake (`snake/`)
- `renderLoop` must be started explicitly; it only ever references itself. It went
  unstarted for weeks and the board stayed black while the score kept climbing.
- Its `onMobile` reassigns `canvas.width`, which clears the canvas — harmless only
  because the render loop repaints. It also resizes the logical board, so
  `syncCanvasLogicSize` re-reads it and `rescaleCoord` moves the snake and fruit onto
  the new grid. Both listeners fire on the same `resize`, in that order.
- Caches its background, fruit and star gradients by key; the head is built at the
  origin and translated, since it moves.

## Carrace (`carrace/`)
- Calls `ctx.roundRect()` 66 times, more than any other game. It is the clearest
  reason the polyfill in `game-utils.js` exists: without it the whole render loop
  throws on Safari below 16.4.

## Pinball (`pinball/`)
- **The plunger lane is a closed chute with no drain.** A ball that stops in it can never
  end, so the game locks up. Two things keep that from happening and both must stay:
  `launchBall()`'s minimum velocity always clears the ceiling guide (needs ≥ ~980 px/s for the
  511 px rise), and the stall watchdog in `updateBall()` returns a stalled ball in the lane to
  `STATE.LAUNCH` without costing a life. The ball can also roll back into the lane from the
  playfield, so the launch floor alone is not enough
- The launch range tops out at `MAX_SPEED`; asking for more is clamped on the first sub-step,
  which would make the top of the charge meter do nothing
- Stall watchdog skips the nudge while a flipper is held, so cradling the ball still works.
  After 3 nudges elsewhere on the table it drains the ball rather than leaving it wedged
- `FL_PIVOT_LX/RX` are `TABLE_MID ± DRAIN_GAP / 2` — `DRAIN_GAP` is the pivot-to-pivot
  distance, so any other divisor breaks the intended 24 px tip gap (dividing by 1.8 opened it
  to 45 px, wide enough to swallow the ball straight down the middle)
- Flippers are stepped **inside** `updateBall()`'s sub-step loop. `collideFlipper` divides the
  angle delta by `sdt`, so stepping them once per frame made omega read 3× high, pinning
  `kickMag` at its clamp and removing all control over shot strength
- Level is `Math.floor(score / 5000) + 1`. It multiplies every award, so an offset here scales
  the whole score curve

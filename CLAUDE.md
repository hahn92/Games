# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A collection of 20 classic browser-based games built with vanilla JavaScript, HTML5 Canvas, and CSS. No build system or dependencies — open any `index.html` directly in a browser to run.

## Running the project

Since this is pure static HTML/JS/CSS, there's no build step. To run locally, use any static file server:

```bash
npx serve .          # serve the root catalog
npx serve ./snake    # serve a specific game
```

Or open `index.html` (root or per-game) directly in a browser.

## Architecture

### Root-level shared files

| File | Purpose |
|------|---------|
| `index.html` | Game catalog/landing page |
| `styles.css` | Shared design system (CSS variables, card layout, global rules) |
| `audio.js` | Shared Web Audio API sound system — `GameAudio.*()` calls |
| `fullscreen-btn.js` | Injects the floating fullscreen/landscape button on mobile |
| `main.js` | Placeholder for future catalog-level JS |

### Per-game structure
Each game lives in its own folder with:
- `index.html` — game page; inline mobile layout script + script tags for `audio.js`, `main.js`, `fullscreen-btn.js`
- `main.js` — all game logic (canvas rendering loop, input handling, game state, `GameAudio` calls)
- `styles.css` — game-specific styles, always starts with `@import url('../styles.css')`
- `image.png` — thumbnail shown in the catalog

### Shared CSS variables (defined in `styles.css`)
```
--primary-color: #8fd3f4
--accent-color:  #ff512f
--bg-dark:       #181818
--card-bg:       #242424
--grad-primary:  linear-gradient(90deg, #8fd3f4 0%, #ff512f 100%)
--grad-bg:       linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)
```

## Complete game list

| Folder | Title | Type | Canvas? |
|--------|-------|------|---------|
| `snake/` | Snake Clásico | Arcade | Canvas |
| `tetris/` | Tetris JS | Puzzle | Canvas |
| `pong/` | Pong Clásico | Arcade | Canvas |
| `breakout/` | Breakout | Arcade | Canvas |
| `2048/` | 2048 | Puzzle | DOM |
| `memorama/` | Memorama | Puzzle | DOM |
| `flappybird/` | Flappy Bird | Arcade | Canvas |
| `spaceinvaders/` | Space Invaders | Shooter | Canvas |
| `whackamole/` | Whack-a-Mole | Arcade | DOM |
| `simon/` | Simon Dice | Memoria | DOM |
| `runner/` | Endless Runner | Arcade | Canvas |
| `minesweeper/` | Buscaminas | Puzzle | DOM |
| `tictactoe/` | Tres en Raya | Estrategia | DOM |
| `connectfour/` | Conecta 4 | Estrategia | Canvas |
| `asteroids/` | Asteroids | Shooter | Canvas |
| `frogger/` | Frogger | Arcade | Canvas |
| `wordle/` | Wordle | Palabras | DOM |
| `typingspeed/` | Velocidad de Escritura | Habilidad | DOM |
| `slidingpuzzle/` | Puzzle 15 | Puzzle | DOM |
| `fruitcatcher/` | Atrapa Frutas | Arcade | Canvas |
| `pacman/` | Pac-Man | Arcade | Canvas |
| `bubbleshooter/` | Bubble Shooter | Arcade | Canvas |
| `hangman/` | Ahorcado | Palabras | DOM |
| `carrace/` | Carrera de Autos | Arcade | Canvas |
| `platformer/` | Plataformero | Plataformas | Canvas |
| `stacktower/` | Apilador de Bloques | Arcade | Canvas |
| `catapulta/` | Catapulta | Física | Canvas |

## Sound system (`audio.js`)

All games use a shared, file-free sound system built on the Web Audio API. Include it **before** `main.js`:

```html
<script src="../audio.js"></script>
<script src="./main.js"></script>
<script src="../fullscreen-btn.js"></script>
```

### Key API calls

| Event | Call |
|-------|------|
| Game starts | `GameAudio.start()` |
| Point scored | `GameAudio.score()` |
| Milestone / combo | `GameAudio.scoreHigh()` |
| Win / level complete | `GameAudio.win()` |
| Game over | `GameAudio.gameOver()` |
| Jump | `GameAudio.jump()` |
| Frog hop | `GameAudio.hop()` |
| Paddle hit | `GameAudio.paddle()` |
| Wall bounce | `GameAudio.hit()` |
| Brick broken | `GameAudio.brick()` |
| Piece lands (Tetris) | `GameAudio.place()` |
| Line cleared | `GameAudio.lineClear()` |
| Shoot / laser | `GameAudio.shoot()` |
| Explosion | `GameAudio.explode()` |
| Water death (Frogger) | `GameAudio.splash()` |
| Reach goal | `GameAudio.goal()` |
| Card flip | `GameAudio.flip()` |
| Cards match | `GameAudio.match()` |
| Cards don't match | `GameAudio.noMatch()` |
| Tile slide | `GameAudio.slide()` |
| Tiles merge (2048) | `GameAudio.merge()` |
| Simon button | `GameAudio.simon(0-3)` |
| Mole hit | `GameAudio.whack()` |
| Mole escaped | `GameAudio.miss()` |
| Mine explodes | `GameAudio.mine()` |
| Safe cell revealed | `GameAudio.reveal()` |
| Letter typed | `GameAudio.type()` |
| Green tile (Wordle) | `GameAudio.correct()` |
| Yellow tile (Wordle) | `GameAudio.present()` |
| Grey tile (Wordle) | `GameAudio.absent()` |
| Fruit caught | `GameAudio.powerUp()` |
| Bomb caught | `GameAudio.bomb()` |
| Timer warning | `GameAudio.tick()` |
| Button click | `GameAudio.click()` |

**Rules:** Never call `GameAudio.*()` inside draw/render functions or loops. One call per event trigger.

The AudioContext is unlocked automatically on the first `touchstart`, `mousedown`, or `keydown` (iOS requirement).

## Mobile support pattern

Every game uses a consistent mobile pattern in `index.html`:

- `isMobile()` UA detection (inline script)
- `adjustMobileLayout()` sets `gameSide` to `position: fixed`, fills the screen, hides `infoSide`
- **Always use `window.innerWidth + 'px'`** (not `'100vw'`) — on iOS Safari `100vw` can exceed the visual viewport
- **Canvas height offset ≤ 50px** — touch button panels are hidden globally via CSS; no large space reservation needed
- Use `window.visualViewport.height` (not `window.innerHeight`) for true mobile viewport height
- `#mobileScore` (absolute positioned) shows score overlay; uses `left: 5px; right: 5px` to stretch safely
- `#mobileStartBtn` overlays the canvas on initial load
- `fullscreen-btn.js` adds a floating ⛶ button (bottom-right) that triggers `requestFullscreen()` + `screen.orientation.lock('landscape')` (Android) or full-screen without lock (iOS)
- Bottom-anchored elements use `bottom: calc(20px + env(safe-area-inset-bottom))` for iPhone notch safety
- Touch controls (`.touch-controls`, `.touch-cols`) are **hidden globally** via `styles.css` with `display: none !important`; all games use swipe/tap gestures on canvas instead

## Critical: Never use emoji on canvas

**Emoji rendered via `ctx.fillText()` on canvas causes transparency/rendering bugs in some browsers.** Always draw game elements as canvas shapes. This applies to:
- Characters/sprites (dino, frog, bird, etc.) → draw with `ctx.arc`, `ctx.roundRect`, paths
- Fruit/food items → custom canvas shapes
- Hearts/lives indicators → draw with bezier curves
- Any game-critical visual

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

## AI patterns used

- **Tic-tac-toe**: full minimax (no depth limit, 3×3 board is always tractable)
- **Connect Four**: minimax with alpha-beta pruning, depth 5; scoring by 4-cell windows in all directions, center column preference
- Both AIs respond after a short delay (300ms) for better UX

## Developer tools

### Skills (slash commands)
Located in `.claude/commands/`:

- `/validate-game [name]` — checks all quality criteria (sound, graphics, mobile, touch, code) for one or all games
- `/add-sounds [name]` — guides adding `GameAudio` calls to a specific game

### Subagents
Located in `.claude/agents/`:

- `game-validator` — validates a game against the full quality checklist
- `sound-auditor` — audits `GameAudio` coverage across all games
- `mobile-auditor` — audits mobile layout, canvas scaling, and touch handling

### Hooks
`.claude/settings.json` runs a code quality check after every `Edit`/`Write` on a `main.js` file. It warns about:
- `ctx.shadowBlur` inside a loop
- Emoji inside `ctx.fillText()`
- `setInterval` used as game loop without `requestAnimationFrame`
- `Math.random()` called inside a render function
- Missing `GameAudio` integration

## Game-specific notes

### Runner (`runner/`)
- Dino is fully canvas-drawn (body, head, snout, eye with blink, tail, legs). **Do not use emoji for the character.**
- Animation system: `squishX/squishY` lerp for jump/land impact, `blinkTimer` for eye blink, tail with `Math.sin` bezier wave, dust particle array on jump/land/run
- Horizontal movement: player can move left/right within `PLAYER_MAX_X = 320`
- Death: `deathAngle` + `deathVY` spin-fall animation + `screenShake` (14 frames)
- Touch: tap = jump, hold left 38% of canvas > 130ms = move left

### Space Invaders (`spaceinvaders/`)
- 3 alien types: Type A (rows 0-1, cyan, antenna+legs), Type B (rows 2-3, magenta, crab+claws), Type C (row 4, orange, octopus+tentacles)
- Bunkers: 4 destructible pixel-grid bunkers between player and aliens
- **No `shadowBlur` on alien draw functions** — this was the main performance bottleneck (40 aliens × multiple shapes = too expensive)
- Tentacle jitter offsets pre-computed on invader creation, not in render loop

### Frogger (`frogger/`)
- Frog is canvas-drawn with `drawFrogShape()`. No emoji.
- Log riding: `frogRidingX` tracks world X position as a float, updated each frame by `lane.speed * lane.dir`
- 5 lily-pad goal slots; all must be filled to advance wave
- Death animation: white flash circle + green particles via `triggerDeathAnim()`
- Hop animation: `frogHop` tween with parabolic arc; blocks new input during animation

### Asteroids (`asteroids/`)
- Thrust fire particles: orange/yellow particles spawned at ship tail when thrusting
- Asteroid trails: last 5 positions stored in `trail[]` array, drawn faded
- Explosion: triangular fragment particles (`spawnFragments()`) that spin and fade
- Screen shake on ship death via translate offset

### Fruit Catcher (`fruitcatcher/`)
- All 10 fruit types + bomb drawn as custom canvas shapes. **No emoji.**
- Items spin as they fall (`rot` + `rotSpeed` per item)
- Lives drawn as custom canvas hearts

### Connect Four (`connectfour/`)
- Discs use radial gradient for 3D sphere look + specular highlight
- Gravity-accelerated fall animation for piece placement
- Win particles burst from each of the 4 winning cells

### Wordle (`wordle/`)
- On mobile: keyboard width set explicitly via JS (`Math.min(window.innerWidth - 16, 390) + 'px'`) to avoid iOS Safari overflow
- `gameSide.overflowX = 'hidden'` and `overflowY = 'auto'` set separately (shorthand `overflow` not supported everywhere)

## Adding a new game

1. Create a new folder with `index.html`, `main.js`, `styles.css`, `image.png`
2. `styles.css` must start with `@import url('../styles.css')`
3. Copy `runner/index.html` as template (most complete mobile pattern)
4. Script tag order in `index.html`:
   ```html
   <script src="../audio.js"></script>
   <script src="./main.js"></script>
   <script src="../fullscreen-btn.js"></script>
   ```
5. In `adjustMobileLayout()`: use `window.innerWidth + 'px'` for width, `≤ 50px` height offset
6. Add `GameAudio.*()` calls for all key game events (never inside render loops)
7. Never use emoji for game-critical visuals — always use canvas shapes
8. Add a game card in the root `index.html` with `onerror` on the img tag
9. Use `requestAnimationFrame` for the game loop, not `setInterval`
10. Run `/validate-game [name]` after finishing to confirm all criteria pass

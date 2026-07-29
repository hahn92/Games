# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A collection of 49 classic browser-based games built with vanilla JavaScript, HTML5 Canvas, and CSS. No build system or dependencies — open any `index.html` directly in a browser to run. Deployed at https://games.hahndev.com (see `CNAME`).

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
| `styles.css` | Shared design system (CSS variables, card layout, global rules) **and the shared game-page layout**: `.responsive-layout`, `.game-side`, `.info-side`, `.mobile-score` are defined here once — per-game `styles.css` must NOT redefine them (only override if a game truly needs a variant). Also holds the shared `@media (max-width: 900px)` collapse; games only declare their own deltas |
| `audio.js` | Shared Web Audio API sound system — `GameAudio.*()` calls |
| `mobile-layout.js` | Shared mobile-layout bootstrap — `MobileLayout({...})`. **Required in every game**, loaded before `main.js`. See "Mobile support pattern" below |
| `game-utils.js` | Shared JS utilities: `rafInterval(fn, ms)` / `rafClear(handle)` — a `setInterval`-compatible fixed-tick loop built on `requestAnimationFrame`. Include it before `main.js` only in games that use it |
| `fullscreen-btn.js` | Inter-game navigation bar (all devices) + fullscreen/landscape button (mobile only). **Required in every game** — see "Navigation bar" below |
| `favicon.svg` | Shared favicon, referenced relatively (`./favicon.svg` from root, `../favicon.svg` from a game) |
| `main.js` | Catalog filter, search and pagination with shareable URLs |

### Per-game structure
Each game lives in its own folder with:
- `index.html` — game page; inline mobile layout script + script tags for `audio.js`, `main.js`, `fullscreen-btn.js`
- `main.js` — all game logic (canvas rendering loop, input handling, game state, `GameAudio` calls)
- `styles.css` — game-specific styles; starts with `@import url('../styles.css')`. The shared layout (`.responsive-layout`, `.game-side`, `.info-side`, `.mobile-score`) comes from the root stylesheet — do not duplicate it here
- Thumbnails are drawn via canvas in `thumbnails.js` — no `image.png` needed

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
| `helicoidal/` | Helicoidal | Física | Canvas |
| `ritmo/` | Ritmo | Ritmo | Canvas |
| `cambiocolor/` | Cambio de Color | Reflejos | Canvas |
| `cosecha/` | La Cosecha | Gestión | Canvas |
| `chess/` | Ajedrez | Estrategia | Canvas |
| `plinko/` | Plinko | Física | Canvas |
| `dardos/` | Dardos Giratorios | Física | Canvas |
| `gemas/` | Gemas | Puzzle | Canvas |
| `minero/` | Minero de Oro | Habilidad | Canvas |
| `laberinto/` | Laberinto Neón | Laberinto | Canvas |
| `sokoban/` | Empuja Cajas | Lógica | Canvas |
| `pinball/` | Pinball Neón | Arcade | Canvas |
| `billar/` | Billar | Física | Canvas |
| `airhockey/` | Air Hockey | Arcade | Canvas |
| `damas/` | Damas | Estrategia | Canvas |
| `reversi/` | Reversi | Estrategia | Canvas |
| `misiles/` | Comando Misil | Shooter | Canvas |
| `saltador/` | Saltador | Arcade | Canvas |
| `batallanaval/` | Batalla Naval | Estrategia | Canvas |
| `blackjack/` | Blackjack | Cartas | Canvas |
| `sopaletras/` | Sopa de Letras | Palabras | Canvas |
| `hanoi/` | Torres de Hanói | Lógica | Canvas |

## Navigation bar (`fullscreen-btn.js`)

**Every game MUST include the inter-game navigation bar.** It is provided by `fullscreen-btn.js`, which renders the navigation bar on all devices (and the fullscreen/landscape button on mobile). There are no exceptions — any new or existing game without it is considered incomplete.

To include it, add the script tag **last**, after `audio.js` and `main.js`:

```html
<script src="../mobile-layout.js"></script>
<script src="../audio.js"></script>
<script src="./main.js"></script>
<script src="../fullscreen-btn.js"></script>
```

When adding or reviewing a game, verify this script tag is present in `index.html`. `/validate-game` should be run to confirm.

## Sound system (`audio.js`)

All games use a shared, file-free sound system built on the Web Audio API. Include it **before** `main.js`:

```html
<script src="../mobile-layout.js"></script>
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

The whole pattern lives in **`mobile-layout.js`**. A game declares only what differs:

```html
<script src="../mobile-layout.js"></script>
<script>
MobileLayout({
    show: { mobileScore: 'block' },          // ids revealed on mobile, hidden on reset
    fit: function (vHeight) {                 // size the canvas/board
        var canvas = document.getElementById('myCanvas');
        var ratio = 400 / 620;
        var availableWidth  = window.innerWidth - 8;
        var availableHeight = vHeight - (isMobile() ? 50 : 0);
        var newHeight = Math.min(availableHeight, availableWidth / ratio);
        canvas.style.width  = newHeight * ratio + 'px';
        canvas.style.height = newHeight + 'px';
    },
    reset: function () {                      // undo `fit` on desktop
        var canvas = document.getElementById('myCanvas');
        canvas.style.width = ''; canvas.style.height = '';
    },
});
</script>
```

Optional keys: `onMobile(gameSide, vHeight)` / `onReset(gameSide)` for extra `gameSide`
setup (wordle), `mobileOnly: true` to skip the `innerWidth < 900` branch (snake, hangman),
`background` for a custom backdrop (pacman uses `'#000'`), `startBtn: false` to never
reveal `#mobileStartBtn` (hangman), `stopPropagation: true` (flappybird).

The module handles, once, for every game:

- `isMobile()` UA detection — exposed as the `window.isMobile` global (`snake/main.js` uses it)
- `adjustMobileLayout()` sets `gameSide` to `position: fixed`, fills the screen, hides `infoSide` — exposed as a global (`minesweeper/main.js` uses it)
- **Always uses `window.innerWidth + 'px'`** (not `'100vw'`) — on iOS Safari `100vw` can exceed the visual viewport
- Uses `window.visualViewport.height` (not `window.innerHeight`) for true mobile viewport height
- `resize` + `visualViewport.resize` + `DOMContentLoaded` listeners, and the `#mobileStartBtn` → `#startBtn` wiring

Remaining per-game conventions:

- **Canvas height offset ≤ 50px** — touch button panels are hidden globally via CSS; no large space reservation needed
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
- Turtles (rows 2 & 4): groups created by `makeTurtles()`; `turtleState(o)` cycles up → warn (blink) → down using `(frame + o.phase) % o.cycle`. Submerged turtles don't hold the frog (`getFrogOnLog` skips state `'down'`)
- Frog rotation: `frogAngle` lerps (shortest path) toward `frogTargetAngle` set per move direction; after `frogUprightTimer` idle frames it returns to face up (never stays tipped sideways)
- River jumps are straight: while mid-hop (`frogHop.t < duration`) there is NO log drift, death check, or goal check — all resolve on landing. Vertical river jumps preserve the exact pixel X; `frog.col` is re-derived from `frogRidingX` at jump time (it goes stale while riding)
- Input buffering: a key pressed in the last 6 frames of a hop is stored in `queuedMove` and executed when the hop ends
- Cars: wheels are drawn BEFORE the body so they peek out from under it (never on top)
- 5 lily-pad goal slots; all must be filled to advance wave
- Death animations via `triggerDeathAnim(cause)`: water = blue flash + expanding ripple rings + rising bubbles; car = squashed frog with splayed legs, X eyes and orbiting stars
- Hop animation: `frogHop` tween with parabolic arc; logs/turtles bob (`o.bob`) and the frog inherits the bob while riding
- Idle tongue flick on safe rows (5, 11) every ~300 frames

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

1. Create a new folder with `index.html`, `main.js`, `styles.css`
2. Copy `runner/index.html` as template (most complete mobile pattern)
3. Script tag order in `index.html`:
   ```html
   <script src="../mobile-layout.js"></script>
   <script src="../audio.js"></script>
   <script src="./main.js"></script>
   <script src="../fullscreen-btn.js"></script>
   ```
4. Call `MobileLayout({ ... })` (see "Mobile support pattern") — do NOT hand-roll an inline
   `adjustMobileLayout`. Use `≤ 50px` height offset in `fit`.
5. **`styles.css`** — copy from `minero/styles.css` and replace `minero-canvas` with your canvas class. Required sections:
   - `@import url('../styles.css')` at the top — this brings in the shared layout (`.responsive-layout`, `.game-side`, `.info-side`, `.mobile-score`); **do NOT redefine those blocks locally**
   - the shared `@media (max-width: 900px)` collapse comes from the root stylesheet —
     add a local block ONLY for game-specific deltas
   - `body { background: var(--grad-bg); ... }`
   - `#startBtn, #restartBtn` button styles
   - `#playAgainBtn` (or equivalent end-of-game button) styles
   - `.popup` and `.popup-content` overlay styles
   - Game-specific canvas class (border: `3px solid var(--accent-color)`, border-radius, box-shadow)
6. Add `GameAudio.*()` calls for all key game events (never inside render loops)
7. Never use emoji for game-critical visuals — always use canvas shapes
8. Add a game card in the root `index.html` — use `<canvas data-game="FOLDER">` (not `<img>`):
   ```html
   <div class="game-card">
       <canvas data-game="FOLDER"></canvas>
       <div class="game-info">
           <div class="game-title">Título</div>
           <div class="game-category">Categoría</div>
           <div class="game-desc">Descripción breve.</div>
           <a class="game-link" href="./FOLDER/index.html" target="_blank">Jugar</a>
       </div>
   </div>
   ```
9. Add a thumbnail drawing function to `thumbnails.js` under the game's folder name key
10. Use `requestAnimationFrame` for the game loop, not `setInterval` — either a rAF loop throttled with `if (ts - lastFrameTs < 15) return;` (see `pinball/main.js`) or, for fixed-tick games, `rafInterval()` from `../game-utils.js` (include its script tag before `main.js`)
11. Run `/validate-game [name]` after finishing to confirm all criteria pass

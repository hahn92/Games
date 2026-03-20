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

### Root level
- `index.html` — game catalog/landing page with cards linking to each game
- `styles.css` — shared design system (CSS variables for colors, gradients, card layout)
- `main.js` — placeholder for future catalog-level JS

### Per-game structure
Each game lives in its own folder with:
- `index.html` — game page; contains inline mobile layout detection script + imports `main.js`
- `main.js` — all game logic (canvas rendering loop, input handling, game state)
- `styles.css` — game-specific styles, always starts with `@import url('../styles.css')` to inherit the shared theme
- `image.png` — thumbnail shown in the catalog

### Shared CSS variables (defined in `styles.css`)
```
--primary-color: #8fd3f4
--accent-color: #ff512f
--bg-dark: #181818
--card-bg: #242424
--grad-primary: linear-gradient(90deg, #8fd3f4 0%, #ff512f 100%)
--grad-bg: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)
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

## Mobile support pattern

Every game uses a consistent mobile pattern:
- `isMobile()` UA detection in `index.html` (inline script)
- On mobile: `gameSide` goes fullscreen (`position: fixed`, 100vw/100vh), `infoSide` is hidden, canvas is resized via `style.width/height` (never change `canvas.width/height` — that resets the drawing context)
- Touch controls (`#touchControls`) shown only on mobile
- A floating `#mobileScore` div shows score overlay on mobile
- A `#mobileStartBtn` button overlays the canvas on initial load
- Use `window.visualViewport.height` (not `window.innerHeight`) for true mobile viewport height
- Bottom controls use `bottom: calc(20px + env(safe-area-inset-bottom))` for iPhone notch safety

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
3. **Use `requestAnimationFrame` not `setInterval`** — rAF syncs with the monitor refresh rate. Use `setInterval` only as fallback. With rAF, throttle to 60fps via timestamp delta: `if (dt < 15) return;`
4. **Never call `ctx.save()/ctx.restore()` inside tight loops** — batching state is faster. Only use save/restore when you truly need to isolate a transform.
5. **No `Math.random()` in the render path** — pre-compute random values (particle offsets, jitter) when spawning, not while drawing.
6. **Stars and small particles: use `fillRect` not `arc`** — rectangle draws are faster than circle draws for small elements.
7. **Cache gradients** — `createLinearGradient`/`createRadialGradient` are expensive. Cache them and only rebuild when position changes.
8. **Pre-cache per-object data** — store color, pre-computed offsets, and other derived values on the object when spawning, not on every draw call.

## AI patterns used

- **Tic-tac-toe**: full minimax (no depth limit, 3×3 board is always tractable)
- **Connect Four**: minimax with alpha-beta pruning, depth 5; scoring by 4-cell windows in all directions, center column preference
- Both AIs respond after a short delay (300ms) for better UX

## Game-specific notes

### Runner (`runner/`)
- Dino is fully canvas-drawn (body, head, snout, eye with blink, tail, legs). **Do not use emoji for the character.**
- Animation system: `squishX/squishY` lerp for jump/land impact, `blinkTimer` for eye blink, tail with `Math.sin` bezier wave, dust particle array on jump/land/run
- Horizontal movement: player can move left/right within `PLAYER_MAX_X = 320`
- Death: `deathAngle` + `deathVY` spin-fall animation + `screenShake` (14 frames)

### Space Invaders (`spaceinvaders/`)
- 3 alien types: Type A (rows 0-1, cyan, antenna+legs), Type B (rows 2-3, magenta, crab+claws), Type C (row 4, orange, octopus+tentacles)
- Bunkers: 4 destructible pixel-grid bunkers between player and aliens
- **No `shadowBlur` on alien draw functions** — this was the main performance bottleneck (40 aliens × multiple shapes = too expensive)
- Uses `requestAnimationFrame` with timestamp throttle, not `setInterval`
- Tentacle jitter offsets pre-computed on invader creation, not in render loop

### Frogger (`frogger/`)
- Frog is canvas-drawn with `drawFrogShape()`. No emoji.
- Log riding: `frogRidingX` tracks world X position as a float, updated each frame by `lane.speed * lane.dir`
- 5 lily-pad goal slots; all must be filled to advance wave
- Death animation: white flash circle + green particles via `triggerDeathAnim()`

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

## Adding a new game

1. Create a new folder with `index.html`, `main.js`, `styles.css`, `image.png`
2. `styles.css` must start with `@import url('../styles.css')`
3. Use the `responsive-layout` / `game-side` / `info-side` layout structure from an existing game (copy from `runner/` as a template — it has the most complete mobile pattern)
4. Follow all canvas performance rules above
5. Never use emoji for game-critical visuals — always use canvas shapes
6. Add a game card entry in the root `index.html` with `onerror` on the img tag:
   ```html
   <img src="./newgame/image.png" alt="Captura del juego" onerror="this.style.background='#2a2a2a';this.removeAttribute('onerror')">
   ```
7. Use `requestAnimationFrame` for the game loop, not `setInterval`

# Arquitectura

Cómo está montado el proyecto: qué hay en la raíz, qué hay en cada juego y el
catálogo completo.

## Overview

A collection of 64 classic browser-based games built with vanilla JavaScript, HTML5 Canvas, and CSS. No build system or dependencies — open any `index.html` directly in a browser to run. Deployed at https://games.hahndev.com (see `CNAME`).

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
| `styles.css` | Shared design system (CSS variables, card layout, global rules) **and the shared game-page layout**: `.responsive-layout`, `.game-side`, `.info-side`, `.mobile-score` are defined here once — per-game `styles.css` must NOT redefine them (only override if a game truly needs a variant). Also holds the shared `@media (max-width: 900px)` collapse; games only declare their own deltas. **Y el cromo compartido de la página de juego**: `.popup`, `.popup-content`, `#startBtn`/`#restartBtn`, `#playAgainBtn`, `.info-side p`, `.buttons-panel`. Estaban copiadas en 29–47 juegos cada una — 2364 declaraciones duplicadas |
| `audio.js` | Shared Web Audio API sound system — `GameAudio.*()` calls |
| `mobile-layout.js` | Shared mobile-layout bootstrap — `MobileLayout({...})`. **Required in every game**, loaded before `main.js`. See "Mobile support pattern" below |
| `game-utils.js` | Shared JS toolkit — loop helpers, math/color helpers, canvas pointer mapping, the `ctx.roundRect` polyfill, safe storage and a particle pool. **Required in every game**, loaded after `audio.js` and before `main.js`. See "Shared toolkit" below |
| `fullscreen-btn.js` | Inter-game navigation bar (all devices) + fullscreen/landscape button (mobile only). **Required in every game** — see "Navigation bar" below |
| `favicon.svg` | Shared favicon, referenced relatively (`./favicon.svg` from root, `../favicon.svg` from a game) |
| `main.js` | Catalog filter, search and pagination with shareable URLs |
| `thumbnails.js` | One canvas-drawing function per game, keyed by folder name. Each thumbnail is drawn the first time its card is actually on screen — see "Catalog thumbnails" below |

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
| `sudoku/` | Sudoku | Puzzle | Canvas |
| `nonograma/` | Nonograma | Lógica | Canvas |
| `solitario/` | Solitario | Cartas | Canvas |
| `minigolf/` | Minigolf | Física | Canvas |
| `bolos/` | Bolos | Física | Canvas |
| `tron/` | Estelas de Luz | Arcade | Canvas |
| `lunar/` | Alunizaje | Física | Canvas |
| `mastermind/` | Descifra el Código | Lógica | Canvas |
| `generala/` | Generala | Dados | Canvas |
| `ciempies/` | Ciempiés | Shooter | Canvas |
| `bombas/` | Bombas | Arcade | Canvas |
| `domino/` | Dominó | Mesa | Canvas |
| `mahjong/` | Mahjong Solitario | Puzzle | Canvas |
| `tiroalblanco/` | Galería de Tiro | Reflejos | Canvas |
| `canastas/` | Canastas | Física | Canvas |

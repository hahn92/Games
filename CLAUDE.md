# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A collection of classic browser-based games built with vanilla JavaScript, HTML5 Canvas, and CSS. No build system or dependencies — open any `index.html` directly in a browser to run.

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
Each game lives in its own folder (`snake/`, `tetris/`, `pong/`, `breakout/`, `2048/`, `memorama/`, `flappybird/`, `spaceinvaders/`) with:
- `index.html` — game page; contains inline mobile layout detection script + imports `main.js`
- `main.js` — all game logic (canvas rendering loop, input handling, game state)
- `styles.css` — game-specific styles, always starts with `@import url('../styles.css')` to inherit the shared theme
- `image.png` — thumbnail shown in the catalog

### Mobile support pattern
Every game uses a consistent mobile pattern:
- `isMobile()` UA detection in both `index.html` (inline) and `main.js`
- On mobile: `gameSide` goes fullscreen (`position: fixed`, 100vw/100vh), `infoSide` is hidden, canvas is resized to fit viewport
- Touch controls (`#touchControls`) shown only on mobile via `setupMobileUI()`
- A floating `#mobileScore` div shows score overlay on mobile
- A `#mobileStartBtn` button overlays the canvas on initial load

### Shared CSS variables (defined in `styles.css`)
```
--primary-color: #8fd3f4
--accent-color: #ff512f
--bg-dark: #181818
--card-bg: #242424
--grad-primary: linear-gradient(90deg, #8fd3f4 0%, #ff512f 100%)
--grad-bg: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)
```

## Adding a new game

1. Create a new folder with `index.html`, `main.js`, `styles.css`, `image.png`
2. `styles.css` must start with `@import url('../styles.css')`
3. Use the `responsive-layout` / `game-side` / `info-side` layout structure from an existing game
4. Add the mobile detection and `setupMobileUI()` pattern from an existing game
5. Add a game card entry in the root `index.html`

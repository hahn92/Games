# Añadir un juego nuevo

1. Create a new folder with `index.html`, `main.js`, `styles.css`
2. Copy `runner/index.html` as template (most complete mobile pattern)
3. Script tag order in `index.html`:
   ```html
   <script src="../mobile-layout.js"></script>
   <script src="../audio.js"></script>
   <script src="../game-utils.js"></script>
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
7b. If the board is built from `<div>`s rather than `<button>`s, wire it with
   `GU.keyActivate` per cell and `GU.gridKeyboard` after each render — otherwise the
   game cannot be played without a mouse. The end-of-game popup needs nothing: as long
   as it carries `class="popup"` and has a heading, `wirePopups` announces it
8. Add a game card in the root `index.html` — use `<canvas data-game="FOLDER">` (not `<img>`):
   ```html
   <div class="game-card">
       <canvas aria-hidden="true" data-game="FOLDER"></canvas>
       <div class="game-info">
           <div class="game-title">Título</div>
           <div class="game-category">Categoría</div>
           <div class="game-desc">Descripción breve.</div>
           <a class="game-link" aria-label="Jugar a Título" href="./FOLDER/index.html" target="_blank">Jugar</a>
       </div>
   </div>
   ```
9. Add a thumbnail drawing function to `thumbnails.js` under the game's folder name key
10. Use `requestAnimationFrame` for the game loop, not `setInterval` — either a rAF loop throttled with `if (ts - lastFrameTs < 15) return;` (see `pinball/main.js`) or, for fixed-tick games, `rafInterval()` or `rafLoop()` from `game-utils.js`
11. Run `/validate-game [name]` after finishing to confirm all criteria pass

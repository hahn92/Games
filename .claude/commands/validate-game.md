# Validate Game Quality

Validate that a game meets all quality criteria for this project. Checks: sound, graphics, mobile layout, touch controls, and code quality.

## Usage
```
/validate-game [game-name]
```
If no game name is given, validate all games.

## Instructions

You are validating games in `/Users/hahn/Documents/Desarrollo/Games/`. For each game to validate, read `main.js`, `index.html`, and `styles.css`, then check ALL criteria below and produce a structured report.

### Criteria Checklist

#### 🔊 Sound (audio.js integration)
- [ ] `<script src="../audio.js"></script>` is present in `index.html`
- [ ] `GameAudio.start()` is called when game starts
- [ ] `GameAudio.gameOver()` is called on game over
- [ ] `GameAudio.score()` or equivalent is called when points are scored
- [ ] Game-specific sounds are used (e.g. `GameAudio.jump()`, `GameAudio.hit()`, etc.)

#### 🎨 Graphics
- [ ] Canvas games use `ctx.fillText()` / `ctx.arc()` etc. for all game elements (NO emoji in canvas)
- [ ] Animations use `requestAnimationFrame`, not `setInterval`
- [ ] No `ctx.shadowBlur` inside draw loops (only on player/UI elements)
- [ ] Canvas size is appropriate for the game type

#### 📱 Mobile layout
- [ ] `index.html` has `adjustMobileLayout()` function
- [ ] Uses `window.innerWidth + 'px'` (NOT `'100vw'`) for gameSide width
- [ ] Canvas height offset is ≤ 60px (no large chunk reserved for hidden touch buttons)
- [ ] `<script src="../fullscreen-btn.js"></script>` is present in `index.html`
- [ ] mobileScore displays current score/stats

#### 👆 Touch controls
- [ ] Canvas games handle `touchstart`/`touchmove`/`touchend` on canvas (swipe gestures)
- [ ] No reliance on hidden touch button panels for gameplay
- [ ] `touch-action: manipulation` is set on interactive elements

#### ⚡ Code quality
- [ ] `requestAnimationFrame` used for game loop
- [ ] No `Math.random()` calls in the render path
- [ ] Score saved to `localStorage` (highScore, etc.)
- [ ] `startGame()` resets all state properly

### Output Format

For each game, output:

```
## [GameName] — [✅ PASS / ⚠️ ISSUES / ❌ FAIL]

### Sound
- ✅ audio.js included
- ✅ GameAudio.start() called
- ❌ Missing: GameAudio.score() not called on scoring
...

### Graphics
...

### Mobile
...

### Touch
...

### Code Quality
...

**Issues to fix:** [list or "None"]
```

End with a summary table of all games and their status.

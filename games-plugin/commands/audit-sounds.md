---
description: Audit GameAudio coverage across all 49 games and list exactly which sounds are missing in each one.
---

# Sound Audit — All Games

Scan every game folder in `/Users/hahn/Documents/Repository/Web/Games/` (the 49 games listed in CLAUDE.md). For each game, read `index.html` and `main.js`.

## Check per game

1. Is `<script src="../audio.js">` present in `index.html`? ✅/❌
2. Which `GameAudio.*` calls exist in `main.js`? List them.
3. Are the four minimum sounds covered?
   - `GameAudio.start()`
   - `GameAudio.gameOver()`
   - `GameAudio.score()` or equivalent
   - `GameAudio.click()` on buttons

## Output — Summary table

| Game | audio.js | start | gameOver | score | click | specific sounds |
|------|----------|-------|----------|-------|-------|-----------------|
| snake | ✅ | ✅ | ✅ | ✅ | ✅ | scoreHigh |
| … | … | … | … | … | … | … |

## Output — Fix list

For every game with missing sounds, list the exact calls needed and the location in `main.js` where each should go. Then print the fix command for each:

```
/games:add-sounds snake
/games:add-sounds tetris
```

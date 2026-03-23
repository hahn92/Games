---
description: Audit GameAudio sound coverage across all 20 games and show which events are missing sounds.
---

# Sound Audit — All Games

Check every game in `/Users/hahn/Documents/Desarrollo/Games/` for `GameAudio` integration. For each game, read `index.html` and `main.js`.

## Check per game

1. Is `<script src="../audio.js">` in `index.html`? (✅/❌)
2. Which `GameAudio.*` calls are present in `main.js`?
3. Are these minimum sounds covered?
   - `GameAudio.start()` — game start
   - `GameAudio.gameOver()` — game over
   - `GameAudio.score()` or equivalent — scoring
   - At least one game-specific sound

## Output

Produce a summary table:

| Game | audio.js | start | gameOver | score | specific sounds |
|------|----------|-------|----------|-------|-----------------|
| snake | ✅ | ✅ | ✅ | ✅ | `score`, `scoreHigh` |
| … | … | … | … | … | … |

Then list every game that is missing sounds, with the exact calls that need to be added. Finish with the command to fix each one:

```
/add-sounds snake
/add-sounds tetris
```

---
description: Add GameAudio sound effects to a specific game. Pass the game folder name (e.g. snake, tetris).
---

# Add Sounds — "$ARGUMENTS"

Integrate `GameAudio` sound effects into `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/`.

## Step 1 — Include audio.js

Check `$ARGUMENTS/index.html`. If `audio.js` is missing, add it **before** `main.js`:

```html
<script src="../audio.js"></script>
<script src="./main.js"></script>
```

## Step 2 — Identify trigger points

Read `$ARGUMENTS/main.js` and find where each event occurs. Map them using this table:

| Event | GameAudio call |
|-------|---------------|
| Game starts | `GameAudio.start()` |
| Button clicked | `GameAudio.click()` |
| Point scored | `GameAudio.score()` |
| Milestone / high score | `GameAudio.scoreHigh()` |
| Win / level complete | `GameAudio.win()` |
| Game over / death | `GameAudio.gameOver()` |
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
| Cards no match | `GameAudio.noMatch()` |
| Tile slides | `GameAudio.slide()` |
| Tiles merge (2048) | `GameAudio.merge()` |
| Simon button (0–3) | `GameAudio.simon(index)` |
| Mole hit | `GameAudio.whack()` |
| Mole escaped | `GameAudio.miss()` |
| Mine explodes | `GameAudio.mine()` |
| Safe cell revealed | `GameAudio.reveal()` |
| Letter typed | `GameAudio.type()` |
| Green tile | `GameAudio.correct()` |
| Yellow tile | `GameAudio.present()` |
| Grey tile | `GameAudio.absent()` |
| Fruit caught | `GameAudio.powerUp()` |
| Bomb caught | `GameAudio.bomb()` |
| Timer warning | `GameAudio.tick()` |

## Step 3 — Apply changes

Add one `GameAudio` call per distinct event. **Never inside draw/render/paint loops.**

## Step 4 — Verify

Run `/games:validate-game $ARGUMENTS` and confirm all Sound criteria pass.

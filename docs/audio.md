# Sonido — `audio.js`

All games use a shared, file-free sound system built on the Web Audio API. Include it **before** `main.js`:

```html
<script src="../mobile-layout.js"></script>
<script src="../audio.js"></script>
<script src="../game-utils.js"></script>
<script src="./main.js"></script>
<script src="../fullscreen-btn.js"></script>
```

## Key API calls

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

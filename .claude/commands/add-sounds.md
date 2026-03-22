# Add Sounds to Game

Add sound effects to a game using the shared `GameAudio` system from `audio.js`.

## Usage
```
/add-sounds [game-name]
```

## Instructions

1. Read `$ARGUMENTS/index.html` to check if `audio.js` is already included.
2. Read `$ARGUMENTS/main.js` to identify the key game events.
3. For each event below, find the right place in the code and add the appropriate `GameAudio.*()` call.

### Sound Mapping (what to add where)

| Event | GameAudio call |
|-------|---------------|
| Game starts / first frame | `GameAudio.start()` |
| Player scores a point | `GameAudio.score()` |
| Milestone / big score | `GameAudio.scoreHigh()` |
| Player dies / game over | `GameAudio.gameOver()` |
| Player wins / level complete | `GameAudio.win()` |
| Jump action | `GameAudio.jump()` |
| Frog hop | `GameAudio.hop()` |
| Ball/bullet hits paddle | `GameAudio.paddle()` |
| Ball/bullet hits wall | `GameAudio.hit()` |
| Brick broken | `GameAudio.brick()` |
| Tetris piece lands | `GameAudio.place()` |
| Tetris line cleared | `GameAudio.lineClear()` |
| Shoot / fire | `GameAudio.shoot()` |
| Explosion | `GameAudio.explode()` |
| Frog lands in water (death) | `GameAudio.splash()` |
| Frog reaches goal slot | `GameAudio.goal()` |
| Card flipped (Memorama) | `GameAudio.flip()` |
| Cards matched | `GameAudio.match()` |
| Cards don't match | `GameAudio.noMatch()` |
| Tile slides (2048 / Puzzle) | `GameAudio.slide()` |
| Tiles merge (2048) | `GameAudio.merge()` |
| Simon button press | `GameAudio.simon(index)` |
| Mole whacked | `GameAudio.whack()` |
| Miss in whack-a-mole | `GameAudio.miss()` |
| Mine explodes | `GameAudio.mine()` |
| Safe cell revealed | `GameAudio.reveal()` |
| Letter typed (Wordle) | `GameAudio.type()` |
| Correct letter (green) | `GameAudio.correct()` |
| Present letter (yellow) | `GameAudio.present()` |
| Absent letter (grey) | `GameAudio.absent()` |
| Fruit caught | `GameAudio.powerUp()` |
| Bomb caught | `GameAudio.bomb()` |
| Timer warning (last 10s) | `GameAudio.tick()` |
| Menu button click | `GameAudio.click()` |

### Steps

1. If `audio.js` not in `index.html`, add before `</body>`:
   ```html
   <script src="../audio.js"></script>
   ```
   (add it BEFORE `fullscreen-btn.js` if that's present)

2. In `main.js`, add the sound calls at the identified locations. Keep calls minimal — one per distinct event. Do NOT add sounds inside render/draw loops.

3. For button clicks (`startBtn`, `restartBtn`, `playAgainBtn`), add `GameAudio.click()` in their event listeners.

4. After editing, run `/validate-game $ARGUMENTS` to confirm sound criteria pass.

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

## Silenciar

`GameAudio` expone `setMuted(bool)` / `isMuted()` / `toggleMute()`, y quien los usa
es **`fullscreen-btn.js`**: pone un botón de altavoz en la barra de navegación, o
sea en los 80 juegos a la vez, y guarda la preferencia en `GameStore` bajo
`gamesMuted`. Un juego no tiene que hacer nada para tenerlo, y **no debe montar
su propio interruptor**: dos controles del mismo estado acaban discrepando.

Estuvo desde el principio en `audio.js` y no lo llamaba nadie — setenta juegos con
sonido y ninguna forma de callarlos sin bajar el volumen del sistema.

El mute vive en `audio.js`, antes del envío al AudioContext, así que silencia
cualquier `GameAudio.*()` sin que el juego se entere ni tenga que comprobarlo.

**Cómo se comprueba que el sonido suena de verdad.** Chrome headless no tiene
audio, así que ahí no se puede saber: hay que abrirlo en un navegador y contar
los osciladores que se crean, envolviendo `AudioContext.prototype.createOscillator`
y su `start()`. Es lo que de verdad suena. Medido así, con una partida en curso:

| | Osciladores |
|---|---|
| jugando con sonido | 13 en los primeros segundos |
| tras pulsar silencio | **0** en tres segundos de partida, y 0 al forzar cuatro sonidos a mano |
| al volver a activarlo | 8 con tres sonidos |

Y un `new AudioContext().state` debe salir `'running'` tras el primer gesto: si
sale `'suspended'`, los osciladores arrancan pero no se oye nada, que es el fallo
clásico en iOS. La preferencia viaja entre juegos —se eligió el silencio en
breakout y pacman arrancó callado— porque vive en `GameStore`, no en la página.

The AudioContext is unlocked automatically on the first `touchstart`, `mousedown`, or `keydown` (iOS requirement).

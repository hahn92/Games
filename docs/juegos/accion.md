# Disparos

Los dos shooters con notas propias.

## Space Invaders (`spaceinvaders/`)
- 3 alien types: Type A (rows 0-1, cyan, antenna+legs), Type B (rows 2-3, magenta, crab+claws), Type C (row 4, orange, octopus+tentacles)
- Bunkers: 4 destructible pixel-grid bunkers between player and aliens
- **No `shadowBlur` on alien draw functions** — this was the main performance bottleneck (40 aliens × multiple shapes = too expensive)
- Tentacle jitter offsets pre-computed on invader creation, not in render loop

## Asteroids (`asteroids/`)
- Thrust fire particles: orange/yellow particles spawned at ship tail when thrusting
- Asteroid trails: last 5 positions stored in `trail[]` array, drawn faded
- **El fondo no se pintaba.** `draw()` empieza con `ctx.fillRect(0, 0, W, H)`
  sobre el degradado azul, pero más abajo, dentro del `if (isPlaying)` de las
  zonas táctiles, había un `var W = canvas.width, H = canvas.height;`. `var` se
  iza al principio de la función, así que W y H quedaban **sombreadas** y valían
  `undefined` justo en esa primera línea: el `fillRect` no pintaba nada, el
  canvas no se limpiaba nunca y las franjas blancas al 8% de las zonas táctiles
  se acumulaban frame tras frame hasta dejar el espacio en blanco.

  Es el fallo más difícil de ver de todos los que hay documentados aquí: no da
  error, el juego responde, la puntuación sube y las formas se dibujan — sólo
  que sobre un fondo que va blanqueando. Se localizó mirando una captura y
  midiendo el píxel de la esquina: (145,152,173) donde tenía que haber
  (13,27,75). Un barrido posterior confirmó que era el único caso del patrón en
  los 64 juegos.
- Explosion: triangular fragment particles (`spawnFragments()`) that spin and fade
- Sacudida y destello rojo al perder una vida. Durante un tiempo esto fue mentira:
  `screenShake`, `shakeOffX`, `shakeOffY` y `deathFlash` se asignaban al chocar y no
  los leía nadie, así que el efecto no se veía. Ahora van sobre el `Shake` del
  toolkit — es el único juego que lo usa. Dos cosas del montaje importan: el fondo
  se pinta **antes** del `translate`, o por el borde contrario asoma una franja del
  frame anterior; y el destello va **después** del `restore`, porque cubre el canvas
  entero y desplazado dejaría una banda sin cubrir

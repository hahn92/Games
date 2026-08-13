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
- Explosion: triangular fragment particles (`spawnFragments()`) that spin and fade
- Sacudida y destello rojo al perder una vida. Durante un tiempo esto fue mentira:
  `screenShake`, `shakeOffX`, `shakeOffY` y `deathFlash` se asignaban al chocar y no
  los leía nadie, así que el efecto no se veía. Ahora van sobre el `Shake` del
  toolkit — es el único juego que lo usa. Dos cosas del montaje importan: el fondo
  se pinta **antes** del `translate`, o por el borde contrario asoma una franja del
  frame anterior; y el destello va **después** del `restore`, porque cubre el canvas
  entero y desplazado dejaría una banda sin cubrir

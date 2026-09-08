# Rendimiento

Las reglas de esta página salen de trabajo de optimización real: cada una
corresponde a un cuello de botella que se midió.

## Miniaturas del catálogo

Cada miniatura es una escena dibujada a canvas, sin imágenes, y vive en su
propio fichero: `thumbnails/<carpeta>.js`. `thumbnails.js` ya no las contiene:
es el cargador que pide la de cada tarjeta **cuando la tarjeta entra en
pantalla**, con un `IntersectionObserver`.

Estuvieron las ochenta en un solo fichero, y el observador difería el DIBUJO
pero no la descarga ni el parseo — 292 KB de JavaScript (56 KB comprimidos) que
la portada se bajaba y parseaba en el hilo principal para pintar las ocho
tarjetas de la primera página. Medido:

| | Antes | Ahora |
|---|-------|-------|
| JS de la portada | 361 KB | **115 KB** (cargador 4 KB + 8 miniaturas) |

Consecuencias al tocar esto:

- **Añadir un juego es añadir `thumbnails/<carpeta>.js`.** No hay lista que
  mantener en el cargador: el nombre sale del `data-game` de la tarjeta. Si el
  fichero falta, la tarjeta se queda con el canvas vacío y se avisa por consola
  — el catálogo sigue funcionando.
- Cada fichero repite los ayudantes (`W`, `H`, la paleta, `roundRect`). Son unos
  900 bytes por fichero y es a propósito: compartirlos obligaría a un segundo
  script y a coordinar su carga, y lo que se ahorra no lo paga.
- Una miniatura se dibuja **una vez**. El canvas conserva sus píxeles cuando la
  tarjeta se vuelve a ocultar, así que no hay nada que repintar al volver.
- Estos canvas se dimensionan desde script, no desde el markup, así que la
  pasada automática de HiDPI los salta. El cargador se apunta con
  `GU.upgradeCanvas(canvas, { pinCss: false })` después de fijar width/height y
  antes de `getContext`. El `pinCss: false` importa: las tarjetas miden el canvas
  con `width:100%` + `aspect-ratio:1/1`, y fijarle un alto explícito ganaría a
  esa proporción y aplastaría la imagen.

## Canvas performance rules

These rules exist because past optimization work identified them as the biggest bottlenecks:

1. **Never use `ctx.shadowBlur` per-alien/per-element in a loop** — shadow compositing is the most expensive canvas operation. Reserve it for the player, bullets, and UI. Set it once before a batch, reset after.
2. **Batch draw state changes** — set `fillStyle`, `globalAlpha`, `shadowBlur` once before drawing a group of similar objects, not inside each iteration.
3. **Use `requestAnimationFrame` not `setInterval`** — rAF syncs with the monitor refresh rate. With rAF, throttle to 60fps via timestamp delta: `if (dt < 15) return;`
4. **Never call `ctx.save()/ctx.restore()` inside tight loops** — only use save/restore when you truly need to isolate a transform.
5. **No `Math.random()` in the render path** — pre-compute random values (particle offsets, jitter) when spawning, not while drawing.
6. **Stars and small particles: use `fillRect` not `arc`** — rectangle draws are faster than circle draws for small elements.
7. **Cache gradients** — `createLinearGradient`/`createRadialGradient` are expensive. Cache them and only rebuild when position changes.
8. **Pre-cache per-object data** — store color, pre-computed offsets, and other derived values on the object when spawning, not on every draw call.

# Trampas conocidas

Cinco formas de romper un juego sin que se note. Tres no dan error en consola;
las otras dos lo dan, y aun así el juego parece que simplemente no ha arrancado
o que le falla otra cosa. Todas costaron tiempo una vez.

## Critical: Never use emoji on canvas

**Emoji rendered via `ctx.fillText()` on canvas causes transparency/rendering bugs in some browsers.** Always draw game elements as canvas shapes. This applies to:
- Characters/sprites (dino, frog, bird, etc.) → draw with `ctx.arc`, `ctx.roundRect`, paths
- Fruit/food items → custom canvas shapes
- Hearts/lives indicators → draw with bezier curves
- Any game-critical visual

## A game can load cleanly and still never draw

`snake` shipped visually dead for weeks. `renderLoop` was defined and only ever
referenced from inside itself, so nothing started it. The one `draw()` at init did
not survive either: `MobileLayout`'s `reset` reassigns `canvas.width` right after,
which clears the canvas.

What made it hard to notice is that the **game logic kept running** on its
`rafInterval` tick — the score in the side panel advanced normally while the board
stayed black. It looks like a rendering glitch, not a dead game.

Nothing in the usual checks catches this: the page loads, the console is clean,
`GameUtils` and the canvas are present, and HiDPI applies. **Loading is not drawing.**

When touching a game's loop, confirm the render entry point is actually reached:

- `requestAnimationFrame(loop)` must appear somewhere *outside* `loop` itself —
  or the loop must be a named function expression handed straight to rAF, as in
  `requestAnimationFrame(function loop(ts) { ... })`, which chess and damas use.
  A grep for "loop referenced only inside itself" flags that second form as a
  false positive.
- The only reliable verification is looking at the canvas. Load the game in a
  visible iframe (offscreen iframes get their rAF throttled by Chrome, and a
  narrow one flips `MobileLayout` into its mobile branch), let a few frames run,
  and take a screenshot. Reading pixels back with `getImageData` from a parent
  frame is **not** trustworthy: it returned all-black for games that were plainly
  rendering on screen.

## El primer frame puede llegar antes que la partida

`freecell` repartía bien y el tapete salía **vacío en el móvil**: se veían las
celdas y las cuatro pilas, y ni una carta en las columnas.

Su `draw()` hace `cols[c].length`, y `cols` nacía como `[]`. En el escritorio no
se notaba porque el clic en Iniciar llega antes del primer frame; en el móvil
`MobileLayout` dispara un `resize` nada más cargar, que pide un repintado
**antes** de que nadie haya repartido. La excepción salta a media función, así
que lo dibujado hasta esa línea se ve y lo de después no — que es justo lo que
hacía parecer que el reparto fallaba.

Un juego que dibuje desde una estructura que se llena al empezar la partida
tiene que poder dibujarse VACÍO. `2048` ya lo hacía por esto mismo: su tablero
se inicializa lleno de ceros porque el `render()` del final del fichero corre al
cargar. Ahora `freecell` nace con sus ocho columnas creadas.

El móvil es donde sale, así que conviene mirarlo ahí: un iframe de 390 px con UA
de iPhone basta, porque Chrome headless no abre ventanas de menos de 500.

## Un juego usado antes de asignarse muere entero y en silencio

`airhockey` y `saltador` cargaban con el canvas **en negro y sin bucle**: ni
lógica, ni entrada, nada. Los dos tenían la misma forma:

```js
loadStats();               // llama a updateHUD()

var gameHud = GU.hud({...});   // ← todavía sin asignar cuando corrió la línea de arriba

function updateHUD() {
    gameHud.set({...});    // TypeError: Cannot read properties of undefined
}
```

`var gameHud` se iza pero vale `undefined` hasta su asignación, así que la
llamada de arriba lanza — y como está en el nivel superior del módulo, **se lleva
por delante todo el resto del fichero**. `2048` tenía la variante con
`ReferenceError`: una línea suelta usaba `highScoreEl`, que es un `const` local de
`render()`, y mataba el `render()` inicial de la línea siguiente.

Lo que hace a estos casos difíciles es que no se distinguen de un juego que
simplemente no ha arrancado: la página carga, el CSS pinta la caja del canvas, la
barra de navegación sale (la mete otro fichero) y sólo la consola lo dice. La
comprobación que los encuentra es cargar los 80 en headless y mirar si alguno
escribe `Uncaught`:

```bash
for d in */; do g=${d%/}
  "$CHROME" --headless --disable-gpu --virtual-time-budget=2500 \
    --enable-logging=stderr --log-level=0 --dump-dom \
    "http://localhost:8899/_harness.html?game=$g&w=900&h=900&clicks=300x300" 2>&1 >/dev/null \
    | grep -iE "Uncaught" | head -2 | sed "s/^/$g: /"
done
```

Los clics importan: un error que sólo salta al interactuar no aparece si el
barrido se limita a cargar la página.

### Su primo, `status`, que funcionaba de milagro

`window.status` existe: es una propiedad heredada de cuando se escribía en la
barra de estado del navegador. A diferencia de `history`, ésta **sí** se puede
escribir… pero convierte a cadena todo lo que le pongas:

```js
var status = 'idle';   // 'idle'   — bien
status = 3;            // '3'      — string, no número
status = null;         // 'null'   — string, y por tanto TRUTHY
```

Lo declaraban **24 juegos** a nivel global. Todos asignaban siempre cadenas
literales, así que funcionaban; pero el día que alguien escribiera
`status = null` para decir «sin estado», el `if (!status)` de al lado habría
sido falso sin dar un solo error en consola.

Están renombrados a `gamePhase`. **En un juego nuevo, no llames `status` a esa
variable.** Y si aparece la duda con otro nombre, la comprobación es directa: un
`var X` a nivel global choca con `window.X` si esa propiedad existe, y el
resultado depende de si es escribible (coerciona, como `status`) o de sólo
lectura (se ignora, como `history`).

Los demás nombres peligrosos —`top`, `length`, `parent`, `closed`— aparecen en
seis juegos, pero **dentro de funciones**, así que son variables locales y no
tocan nada.

## Never call `adjustMobileLayout()` by hand

Several games register their own `resize` listener beside the one
`mobile-layout.js` installs, and they depend on running **after** it. `snake` is
the clearest case: `MobileLayout`'s `onMobile` reassigns `canvas.width` to fit the
viewport, and snake's own `syncCanvasLogicSize` then re-reads it into `canvasSize`
and rescales the snake and the fruit onto the new grid. Because `index.html` runs
before `main.js`, the listeners already fire in that order on a real resize.

Calling `adjustMobileLayout()` directly resizes the canvas without the second half
of that pair. Snake's logic then keeps using the old board size: the snake can walk
outside the visible canvas and fruit can spawn where it is unreachable — exactly
the failure `rescaleCoord` exists to prevent.

So when testing orientation changes, resize and **dispatch a real `resize` event**;
do not invoke the layout function yourself. Verified across all 40 canvas games,
portrait → landscape → portrait: nothing overflows, aspect ratios hold, every game
recovers its original size, and snake's grid stays consistent (box 9 → 8 with the
snake and fruit rescaled onto matching cells).

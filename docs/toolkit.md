# Toolkit compartido — `game-utils.js`

Loaded by every game, after `audio.js` and before `main.js`. Everything is on the
`GameUtils` namespace (aliased `GU`); a handful of names are also flat globals
because games already called them unqualified.

**Do not re-implement any of these in a game.** Each one replaced a per-game copy.

| Group | API |
|-------|-----|
| Loop | `rafInterval(fn, ms)` / `rafClear(h)` — fixed-tick loop; `rafLoop(fn, minMs)` — free-running ~60fps loop, `fn(dt, ts)` with `dt` clamped so a backgrounded tab can't tunnel bodies through walls; `rafDraw(fn, {el, events, minMs})` — draw-on-demand loop for a board that only changes when something happens, `.invalidate()` asks for a frame |
| Math | `clamp`\*, `lerp`\*, `GU.dist`, `GU.dist2`, `GU.rand`, `GU.randInt`, `GU.pick`, `GU.shuffle`, `GU.angleDelta`, `GU.easeOutQuad` / `easeInQuad` / `easeInOutQuad` |
| Collision | `GU.rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh)`, `GU.circlesOverlap(x1,y1,r1, x2,y2,r2)` |
| Color | `hexToRgb`\*, `shade(hex, ±d)`\* (additive), `GU.scaleColor(hex, f)` (multiplicative), `GU.rgba(hex, a)`, `GU.mixColor(a, b, t)` |
| Canvas | `pointerPos(canvas, e)`\* → `{x, y}` in canvas space; `GU.roundRectPath(ctx, x,y,w,h,r)`; `GU.gradientMemo()` |
| Shapes | `GU.starPath(ctx, cx,cy, outer, inner?, points?, rot?)`, `GU.heartPath(ctx, cx,cy, size)`, `GU.polygonPath(ctx, cx,cy, r, sides, rot?)` — paths only, you fill/stroke |
| Sprites | `GU.sprite(w, h, draw, {pad, maxScale})` → `.draw/.drawCentered/.drawRotated`; `GU.spriteSheet(build)` → `.get(key)` |
| Input | `GU.swipe(el, {onSwipe, onTap, minDist, maxTime, live, mouse, preventDefault})`; `GU.keys(bindings, {preventDefault, onPress, onRelease})` → `.down/.pressed/.set/.flush/.clear` |
| HUD | `GU.hud({field: id, mobile: {el, html}})` → `.set/.add/.get/.refresh` (un campo a `null` se sigue sin pintarlo); `GU.popup(id)` → `.show(fields)/.hide()/.visible()`; `GU.highScore(key, {lower})` → `.value/.submit/.display/.has/.reset`; `GU.formatTime(ms, {ms, hours})` |
| Controles | `GU.controls({start, restart, playAgain, popup, sound})` → `.running()/.idle()` — cablea los tres botones de la página; `GU.buttons(selector, handler)` para un botón que sale más de una vez |
| Mesa | `GU.idleScreen(ctx, {title, lines, bg, band})` — la pantalla de reposo; `GU.toast()` → `.show(txt, secs)/.update(dt)/.draw(ctx,x,y)/.active()`; `GU.minimax({moves, apply, evaluate, isOver, order})` → `.best(state, side, depth)`; `GU.cards({w,h})` → `.deck()/.face(s,r)/.back()/.suitPath()/.isRed()`; `GU.drawDie(ctx,x,y,size,valor)` y `GU.rollDie(caras)`; `GU.canvasButtons()` → `.add/.at/.targets/.draw` |
| Shake | `new Shake({decay, ratio, max})`\* with `.hit(mag)`, `.update(dt)`, `.translate(ctx)`, `.active()`, `.stop()` |
| Storage | `GameStore.getNum/setNum/getJSON/setJSON/get/set/remove`\*, `GameStore.available` |
| Particles | `new Particles(max, {semiImplicit})`\* with `.burst(x, y, n, opts)`, `.add(x, y, vx, vy, opts)`, `.update(dt)`, `.draw(ctx)`, `.each(fn)`, `.clear()` |
| HiDPI | automatic; `GU.upgradeCanvas(canvas, {maxScale, pinCss})` for canvases sized at runtime |
| Accessibility | `GU.keyActivate(el, label)` — makes a non-`<button>` cell focusable and Enter/Space-operable; `GU.gridKeyboard(container, cols, selector)` — roving tabindex + arrow navigation over a board; `GU.canvasCursor(canvas, opts)` — the same idea for a canvas; `GU.wirePopups()` — automatic, turns the `.popup` overlays into announced dialogs |

\* also available as a flat global.

## Why these exist

- **`ctx.roundRect` polyfill** — installed automatically when the browser lacks it
  (Safari < 16.4). A dozen games call `ctx.roundRect()` directly; without the
  polyfill that throws and takes the whole render loop down on older iOS.
- **`pointerPos`** — every canvas game needs mouse/touch → canvas-space mapping,
  and it must divide by `rect.width`, not just subtract `rect.left`: `mobile-layout.js`
  resizes canvases via `style.width/height`, so the CSS box and the backing store differ.
  Handles `touches`, `changedTouches`, plain mouse events and bare `Touch` objects,
  and guards the divide on a zero-size (hidden) canvas.
- **`GameStore`** — `localStorage` *throws* rather than returning null when site data
  is blocked (Safari "Block All Cookies", sandboxed iframes). Games read their high
  score at module top level, so an unguarded access kills `main.js` before anything
  renders. Every accessor degrades to an in-memory map, so a session still keeps its
  score. `GameStore` never throws — do not wrap it in `try`/`catch`.
- **`Particles`** — pooled; dead particles are reused instead of being spliced out of
  an array each frame, and `draw()` batches `fillStyle` changes. `burst()` picks angles
  and speeds for you; `add()` takes an explicit velocity, for effects with a directional
  bias or a jittered origin. **`life` is in seconds**: porting a per-frame
  `life: 1, decay: d` loop means `life: 1 / (d * 60)`, which reproduces the lifetime and
  the linear alpha ramp exactly at 60fps. Use `alpha` when the old code started below
  full opacity (a `life: 0.8` peak becomes `alpha: 0.8`). `update()` moves before
  integrating gravity, matching the hand-rolled loops it replaced.
  `new Particles(max, {semiImplicit: true})` accelerates before moving, which is what
  the delta-time loops did; the default moves first, like the per-frame loops. Getting
  this backwards shifts a particle's path by a few pixels over its life.
  Currently used by: airhockey, batallanaval, billar, breakout, catapulta, dardos,
  hanoi, helicoidal, minero, misiles, platformer, pong, saltador, sopaletras, stacktower.
  The other particle systems stay hand-rolled on purpose — they draw rotated ellipses,
  hue-cycling sparks, trails or fragment shapes the shared pool does not render.
- **HiDPI** — applied automatically at load to every canvas **whose size is declared in
  the markup**. `canvas.width`/`height` keep reporting the LOGICAL size, so game logic,
  hit testing and `pointerPos()` are unaffected; only the backing store and a base
  `scale(dpr)` transform change. Capped at 2×. Opt a canvas out with `data-no-hidpi`.
  Because of this, **never assume `canvas.width` is the backing-store size** — and if a
  game ever needs to resize its canvas, assigning `canvas.width` still works and the base
  transform is reinstalled.
  A canvas sized from script instead (the catalog thumbnails) is skipped by the automatic
  pass — its real size is not known yet — and must call `GU.upgradeCanvas()` itself right
  after setting width/height and before `getContext()`. Pass `{pinCss: false}` when a
  stylesheet already sizes it: the CSS pin sets an explicit height, which would override
  an `aspect-ratio` that nothing else constrains and squash the element.
- **`keyActivate` / `gridKeyboard`** — several DOM games build their board out of
  plain `<div>`s with only a click listener, which made them unplayable without a
  mouse (WCAG 2.1.1, level A). `keyActivate` gives a cell what a real `<button>`
  would have: focus, a button role and Enter/Space. `gridKeyboard` then keeps only
  ONE cell in the tab order and moves with the arrows — without it a hard
  minesweeper board is 480 separate tab stops. Call `gridKeyboard` again after each
  render: these games rebuild their cells every move, and it re-seats the tabbable
  cell and restores focus to the square the player was on.
  Used by memorama, minesweeper, tictactoe and whackamole. A cell that overrides
  `outline` needs its own `:focus-visible` rule, as `.ttt-cell` does.
- **`canvasCursor`** — the canvas counterpart of `gridKeyboard`. A group of canvas
  games were pointer-only: their whole interaction was a click handler mapping a
  pixel to a square, a tower or a button, so nothing in them was reachable without
  a mouse.

  It knows nothing about the game's topology. The game returns a flat list of
  targets in canvas coordinates and the arrows pick the nearest one in that
  direction geometrically — which is why one implementation covers an 8×8 board,
  three Hanoi towers and a row of blackjack buttons. Sideways drift is weighted
  ×3 so a straight neighbour always beats a closer diagonal, or a board reads as
  wandering instead of stepping.

  ```js
  var cursor = GU.canvasCursor(canvas, {
      label:    'Tablero. Flechas para moverte, Enter para elegir.',
      targets:  function () { return [{x, y, w, h, id}, ...]; },  // se consulta fresco
      activate: function (t) { handleClick(t.x + SQ/2, t.y + SQ/2); },
      onChange: draw            // sólo si el juego no repinta en bucle
  });
  ```

  Things that are load-bearing here:

  - **Call the game's own click path from `activate`.** Every game wired so far
    reuses its existing handler, most after splitting `handleAt(x, y)` out of the
    event handler. No game logic is duplicated, so the two input modes cannot
    drift apart.
  - **`targets()` is re-read on every keypress**, so a game that rebuilds its list
    each frame (blackjack) needs no bookkeeping. Identity is by `id`, and a
    remembered id is NOT forgotten when it is transiently missing — blackjack
    empties its button list entirely while dealing.
  - **Un juego de arrastrar también entra**, y sin lógica nueva. `solitario` y
    `sopaletras` se conducen arrastrando —de la carta al montón, de la primera
    letra a la última— y arrastrar no existe sin ratón: eran los dos juegos que
    no se podían jugar de ninguna otra forma. El teclado no duplica nada: el
    cursor recorre las zonas y Enter llama al MISMO `pick`/`drop` (solitario) o
    escribe los MISMOS `dragStart`/`dragEnd` (sopaletras) que escribe el ratón.
    El primer Enter coge, el segundo suelta, y `onChange` arrastra lo cogido
    hasta el cursor mientras te mueves — que es lo que enseña dónde va a caer.
    Los dos aceptan Escape para soltar sin confirmar: sin salida, un montón
    levantado por error obliga a soltarlo en cualquier parte.
  - **Visibility follows `:focus-visible`, not focus.** Hiding the ring on
    `mousedown` alone is wrong: clicking a canvas that already has focus fires no
    new `focus` event, so the ring never returns and the arrows drive something
    invisible. That bug shipped briefly and was only caught by looking at the
    canvas. Tab in → ring shows; click → ring hides; next arrow → ring returns.
  - The game still draws the ring itself, from `cursor.target()`. Draw it **after**
    the pieces: it is a focus indicator, not a board decoration.

- **`wirePopups`** — runs on its own, no game calls it. The 45 end-of-game overlays
  are divs toggled with `display`, so a screen reader never learned the game had
  ended. It marks them as `alertdialog`, names them from their heading and moves
  focus into them when they appear. Careful with visibility checks here:
  `offsetParent` is null for `position: fixed`, which every one of these popups is.
- **Las piezas de mesa** (`idleScreen`, `toast`, `minimax`, `cards`, `drawDie`,
  `canvasButtons`) salieron de medir qué se repetía entre los 70 juegos:

  - **`idleScreen`** — 30 juegos llevaban la MISMA función de doce líneas
    cambiando sólo colores y texto, y con tres formas distintas de dejar el
    contexto: unos restauraban `textAlign` y otros no, lo que movía el texto del
    siguiente que dibujara. Aquí va con `save`/`restore`. `band: true` cubre sólo
    una franja central, que es lo que quiere un juego cuyo tablero se sigue
    viendo detrás.
  - **`toast`** — el mensaje efímero sobre el tablero, que seis juegos llevaban
    como la pareja `msg` + `msgT` con el descuento repetido en su bucle. Es una
    pieza de ESTADO, no de dibujo: `active()` es justo lo que un bucle de
    `rafDraw` necesita devolver para seguir pintando mientras el mensaje está en
    pantalla.
  - **`minimax`** — siete juegos llevaban su copia de la misma búsqueda con poda
    alfa-beta. Dos cosas del contrato importan y las dos salieron de escribir las
    pruebas:

    `apply` devuelve **a quién le toca**, no se alterna por dentro. Eso es lo que
    permite que valga para mancala (una jugada puede repetir turno), para reversi
    (un bando pasa) y para timbiriche (cerrar cuadro repite). Alternar a ciegas
    es el fallo clásico de esas IA.

    `evaluate(state, maxSide, depth)` recibe el **maximizador**, no el que mueve,
    y la **profundidad restante**. Lo primero es lo que hace que un evaluador
    simétrico sirva para los dos bandos; con la otra firma hay que escribir uno
    por bando y el segundo sale del revés sin avisar. Lo segundo hay que usarlo
    en las victorias (`gana ? 1000 + depth : …`) o ganar ahora y ganar en tres
    valen igual, la IA elige entre ellas al azar y se queda mirando un remate
    servido.

    Y una del motor: **la raíz busca con la ventana completa**, sin arrastrar el
    alpha de una jugada a la siguiente. Con la ventana estrecha, una jugada peor
    devuelve el recorte —exactamente `alpha`— en vez de su valor, entra empatada
    con la mejor y `pick` acaba eligiéndola: con eso la IA dejaba de rematar y de
    bloquear, y dos minimax perfectos de tres en raya no llegaban a tablas.
    Dentro del árbol la poda sigue entera.
  - **`cards`** — las 52 caras y el dorso prerenderizados, sacados de solitario.
    `r` es el índice 0..12, así que el as es 0 y el rey 12 y las reglas quedan en
    aritmética directa. Los palos son paths: la baraja no lleva un solo emoji.
  - **`drawDie` / `rollDie`** — la cara de un dado con puntos. Nunca con texto:
    «⚀» es exactamente lo que la regla del proyecto prohíbe en canvas.
  - **`canvasButtons`** — el botón dibujado sobre el tablero, con su hit-test, su
    estado apagado y —lo que siempre se olvida— la lista de `targets` para
    `GU.canvasCursor`, sin la cual el juego vuelve a ser sólo para ratón. Se
    reconstruyen cada frame a propósito: así un botón que aparece según el turno
    no necesita que nadie lo sincronice.

- **`rafDraw`** — diecisiete juegos por turnos repintaban un tablero quieto sesenta
  veces por segundo. Medido en chess con el contexto instrumentado: **99 operaciones
  de canvas y 10 construcciones de degradado por frame** en la pantalla de reposo, o
  sea 600 degradados por segundo para no cambiar un pixel. Aqui `fn` sólo corre en
  los frames que alguien ha pedido, y cuando no hay nada que pedir el bucle deja de
  encolar rAF del todo.

  Lo que hace que esto no acabe en la pantalla congelada de
  [Trampas](./trampas.md) son dos cosas, y las dos importan:

  - **La entrada invalida sola.** Puntero y teclas se escuchan en **fase de
    captura**, así que un juego que llame a `stopPropagation` conserva su
    repintado. Todo cambio que empieza en el jugador queda cubierto sin que el
    juego recuerde nada — que es justo lo que no se puede pedir a 17 ficheros.
  - **Lo que NO empieza en el jugador tiene que avisar**: la jugada de la IA en su
    `setTimeout`, un temporizador. En los juegos migrados es una línea por
    `setTimeout(aiTurn, …)`.

  El valor de retorno es lo que sostiene una animación ya en marcha:
  `return fx.count > 0` mantiene el bucle mientras queden partículas. Devolver
  nada lo duerme. Y el `dt` se mide desde el último frame **pintado** y va
  acotado como el de `rafLoop`, así que despertar tras un minuto quieto da un
  paso normal, no uno de sesenta segundos.

  Un reloj es el caso que no encaja solo: si el juego enseña un cronómetro, algo
  tiene que pedir el frame. Los que lo pintan **dentro** del canvas (sudoku,
  nonograma) lo hacen desde un `setInterval` de 250 ms — cuatro repintados por
  segundo bastan para un contador en segundos, frente a sesenta. Los que sólo lo
  enseñan en el HUD (futoshiki, mahjong, solitario) no necesitan ni eso: refrescan
  el HUD desde ese mismo intervalo y el canvas sigue durmiendo. En mahjong eso
  arregló de paso algo peor: su línea de móvil llama a `freePairs()`, que recorre
  el tablero entero, y se recalcula en CADA `set()` — pasó de 60 veces por segundo
  a 4.

  Migrados: chess, damas, reversi, hanoi, sudoku, nonograma, solitario, mastermind,
  generala, domino, mahjong, tuberias, lightsout, gomoku, futoshiki, mancala y
  molino. **blackjack se dejó a propósito**: su flujo es una cascada de
  `setTimeout` con las cartas interpolándose hacia su sitio, así que casi todos
  sus frames son frames con movimiento y lo que se ahorraría no compensa el
  riesgo de dejar una mano a medio repartir.

- **`gradientMemo`** — gradients are among the more expensive 2D calls. Key on
  everything the gradient depends on, geometry and colour stops both, and make sure the
  key is BOUNDED: keying on a scrolling or animated coordinate leaks a gradient per
  frame. For per-object gradients that differ only by position, build at the origin and
  `ctx.translate()` instead (see `chess/drawBoard`, `frogger/drawLogs`,
  `reversi/drawDisc`, `stacktower/blockGrad`, `flappybird/drawPipe`).

- **`Shake`** — eleven games grew their own screen shake and three of them
  (batallanaval, misiles, sopaletras) picked the offsets with `Math.random()` inside
  `draw()`, which the performance rules forbid: a frame repainted twice — as happens on
  a resize — jittered. Here the offsets are state, chosen in `update()`.
  `hit()` takes the MAX rather than adding, so a small knock during a big one cannot cut
  it short and a burst of small ones cannot compound into a convulsion. Decay is
  exponential and **framerate independent**; when porting a per-frame decrement, solve
  for the decay that reproduces the old duration rather than guessing
  (batallanaval's `-= 0.6` from 10 over ~17 frames became `decay: 0.76`).

- **`swipe`** — nine games hand-rolled directional gestures and disagreed on every
  parameter that matters: threshold, whether a slow drag counts, and whether the gesture
  resolves on `touchend` or as soon as it crosses the threshold. The differences were
  accidents, not decisions. `live: true` is the "resolve on crossing" variant that
  continuously-steered games want; the default resolves on release, which is right when
  a gesture means exactly one move. `onTap` hands back **canvas coordinates** when the
  target is a canvas, so a tap can be routed straight into the game's existing click
  handler without duplicating the hit test.

- **`keys`** — binds by ACTION, not key code, so alternate keys cost one array entry.
  Two bugs it fixes that most hand-rolled key maps have: a keydown with no matching
  keyup (alt-tab, a focus-stealing overlay) leaves the action held forever and the
  player returns to a ship flying into a wall — everything is released on `blur` and on
  `visibilitychange`; and `preventDefault: true` stops arrows scrolling the page and
  Space activating the focused button, **for the bound keys only**, so a game that also
  has real `<button>`s keeps them operable. `e.repeat` is filtered out of the press edge,
  or the OS key-repeat rate turns one keypress into a burst of shots.

- **`controls`** — los tres botones de una página de juego (Iniciar, Reiniciar y el
  "Jugar de nuevo" del popup) estaban cableados a mano en 49 juegos con el mismo
  bloque de doce líneas, y el vaivén de `disabled` entre los dos primeros repartido
  por `startGame`/`gameOver`. Emite `GameAudio.click()` **antes** del handler, porque
  el handler puede cambiar de pantalla; y `playAgain` esconde el popup **antes** de
  llamar, o queda un frame con el overlay sobre el tablero ya reiniciado. `restart`
  cae en `start` y `playAgain` en `restart` cuando no se declaran. Un botón que no
  está en el markup se ignora sin ruido — chess y damas no tienen ninguno.

- **`buttons`** — el hermano de `controls` para los botones que salen DOS VECES en
  la página. chess, damas, reversi y hanoi repiten sus controles en el panel de
  escritorio y en la tira de encima del tablero, así que no pueden llevar id —un
  id tiene que ser único— y van por clase. Los cuatro escribían el mismo bucle de
  `querySelectorAll(...).forEach(addEventListener)`. Se resuelve una vez, al
  llamar: un juego que cree botones después tiene que volver a llamar, igual que
  con `gridKeyboard` tras cada render.

- **`keys().set(action, held)`** — fija una acción a mano, sin tecla de por medio.
  Es para el control táctil: en móvil no hay teclado, y un juego de mantener
  pulsado (empujar el motor en `lunar`, girar) necesita decir "esta acción está
  activa mientras el dedo siga en esta zona". Sin esto cada juego acaba con dos
  fuentes de verdad —el mapa de teclas y un objeto de toques aparte— y la lógica
  tiene que consultar las dos. Dispara `onPress`/`onRelease` igual que una tecla.

- **`keys` y la tecla encallada** — siete juegos llevaban un mapa de mantener
  pulsado (`keys[e.key] = true` en keydown, `false` en keyup) y **ninguno de los
  siete soltaba nada al perder el foco**. Alt-tab con una flecha pulsada devolvía
  la nave acelerando sola, la pala corriendo o al dino contra un cactus: el
  keyup se lo lleva la otra ventana y la tecla se queda pulsada para siempre.
  `GU.keys` suelta todo en `blur` y en `visibilitychange`. Migrados: asteroids,
  breakout, fruitcatcher, platformer, pong, runner y spaceinvaders.

  Los controles táctiles de esos juegos escribían en el MISMO mapa con teclas
  inventadas (`keys['thrust']`, `keys['left']`), lo que era la única forma de que
  la lógica leyera un solo sitio. Ahora hacen lo mismo con `keys.set(accion, …)`,
  que es para lo que existe.

  Los otros juegos con teclado usan keydown de flanco, sin estado retenido: ahí
  no hay tecla que encallar y migrarlos es dedup sin más.

- **`swipe`, lo que había realmente** — los diez gestos migrados no estaban en
  desacuerdo por decisión, sino por accidente: 2048 medía con `screenX` y el
  resto con `clientX`; el umbral iba de 10 px a 30 pasando por 15 y 18; sólo
  laberinto descartaba un arrastre lento; y todos resolvían al levantar el dedo,
  incluidos pacman y snake, que se conducen en continuo y ahora usan `live: true`.

- **`hud`** — 47 games write their score twice, to the side panel and to `#mobileScore`.
  Writing `textContent` invalidates layout even when the string is identical, so a
  score that changes once a second was costing 60 layout invalidations a second to say
  the same thing. Every write here is dirty-checked. Call `.refresh()` after a layout
  switch has replaced the nodes.

  **Sigue el texto ya formateado, no la magnitud en crudo.** Un campo con `elapsedMs`
  cambia en cada frame y deja el filtro sin efecto; el mismo campo con
  `fmtTime(elapsedMs)` cambia diez veces por segundo. Igual con `Math.ceil(timeLeft)`
  frente a `timeLeft`.

  **La línea de móvil se recalcula en CADA `set()`** y se filtra comparando el
  texto que produce, no los campos. Es a propósito: casi todas esas líneas enseñan
  algo que el panel de escritorio no tiene —las vidas, el combo, un reloj— y su
  callback lo lee por cierre. Si sólo se repintara al ensuciarse un campo, cada
  juego tendría que acordarse de declarar todas esas variables, y olvidar una deja
  la línea congelada sin dar un solo síntoma en consola. Construir la cadena es
  concatenar; lo caro es tocar el DOM, y eso lo sigue evitando la comparación. Hay
  dos pruebas que lo fijan, incluida la de que 60 `set()` sin cambios no escriben.

  **Un campo puede valer `null`**: se sigue su valor pero no se pinta en ningún
  sitio. Ya no hace falta para que la línea de móvil se entere de nada — sirve para
  documentar de qué depende esa línea y para poder leerlo con `.get()`.

  Sólo cinco juegos escribían el HUD de verdad en cada frame (spaceinvaders desde
  `draw()`, cosecha y minero desde el bucle, laberinto desde `render`); están
  migrados. El resto lo hace por evento y se dejaron como estaban a propósito: ahí
  la migración es dedup sin ganancia medible.

- **`highScore`** — the load-compare-store dance, done once. The three games that record
  a TIME rather than a score (laberinto, memorama, slidingpuzzle) each had to invert the
  comparison themselves, and laberinto's got it wrong; `{lower: true}` inverts it here.
  An empty slot is ±Infinity, not 0, so the first run always registers as a record —
  which a `0` default gets wrong for times, where any real time is worse than zero.
  `submit()` persists as a side effect on purpose: splitting the compare from the write
  is how you end up comparing against the value you just stored.

- **`sprite` / `spriteSheet`** — draw once into an offscreen canvas, then blit. Es la
  palanca más grande que hay en estos juegos, y lo medido lo confirma. Los cuatro
  sitios donde se ha aplicado, con las operaciones de canvas por frame contadas
  instrumentando el contexto:

  | Juego | Antes | Después | Qué se prerenderizó |
  |-------|-------|---------|---------------------|
  | `spaceinvaders` | 1807 | **400** | los 40 aliens: son SEIS dibujos —tres tipos por dos poses— repetidos |
  | `gemas` | 535 | **93** | las 7 gemas; se fueron de paso 44 `setTransform` por frame |
  | `billar` | 76 | **33** | las 16 bolas, con su degradado radial y su número |
  | `bubbleshooter` | — | — | el primero: un degradado radial por burbuja y por frame |

  Lo que hace que un caso sea buen candidato no es que dibuje mucho, sino que
  dibuje **pocas cosas distintas muchas veces**. En spaceinvaders eso se ve
  claro: cuarenta aliens, seis dibujos. Y lo que hay que mirar antes de migrar es
  qué parte cambia por frame — en la nave de ese mismo juego, las llamas laten
  con `glowPulse` y se quedaron fuera del sprite; meterlas dentro las congela.

  `drawCentered(ctx, x, y, scale)` acepta escala sin coste de `save`/`restore`,
  que es lo que permite usar sprite en un objeto que crece o encoge — una bola
  hundiéndose en la tronera, una gema desapareciendo.
  Anything drawn many times from the same shapes is a candidate. The offscreen canvas is
  allocated at device pixel density and the draw callback runs pre-scaled, so sprites stay
  sharp on a phone while both the callback and the blits work in logical pixels — a
  sprite is a drop-in for the shape code it replaces. `spriteSheet` keys must be BOUNDED,
  the same warning as `gradientMemo` and worse here: a key on a moving coordinate leaks a
  whole canvas per frame.

- **`starPath` / `heartPath` / `polygonPath`** — the emoji ban means every star, heart and
  polygon is hand-built from paths, and seven games carry a copy of the star, three the
  heart. These call `beginPath()` and leave the path current without filling, so the
  caller sets `fillStyle` once for a whole batch instead of once per shape.

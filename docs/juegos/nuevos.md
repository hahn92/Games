# Sudoku, Nonograma, Solitario, Minigolf y Bolos

Los cinco juegos que se añadieron después de los 49 originales. Todos usan las
piezas nuevas de `game-utils.js` (`hud`, `popup`, `highScore`, `formatTime`,
`Shake`, `swipe`, `sprite`), así que son también la referencia de cómo se usan.

## Sudoku (`sudoku/`)

- **`countSolutions` no puede ser un backtracking ingenuo.** `makePuzzle` lo
  llama una vez por casilla que intenta quitar, unas 80 veces por partida, y
  sobre una rejilla de 28 pistas la versión que coge la primera casilla vacía
  tarda tanto que la pestaña se cuelga al generar en Difícil. Lleva dos cosas y
  las dos hacen falta: máscaras de bits incrementales por fila/columna/bloque, y
  elegir siempre la casilla con **menos candidatos** (MRV) abandonando la rama en
  cuanto una se queda sin ninguno. Con ambas, generar en Difícil baja de
  *colgarse* a **1 ms**.
- **El solucionador se fía de sus pistas.** Sólo impide que un número *nuevo*
  choque; no comprueba que las que ya están sean legales. Una rejilla con dos
  cifras iguales en la misma fila no se detecta y demostrar que no tiene solución
  sobre un tablero casi vacío es carísimo. Da igual porque la única entrada
  posible sale de quitar casillas de una solución válida — pero no lo llames con
  nada más.
- Las casillas se quitan **de dos en dos por simetría central**, como los sudokus
  impresos. El objetivo de pistas es aproximado a propósito: forzarlo exacto
  puede no ser alcanzable manteniendo unicidad y el bucle se quedaría girando.
- El récord es un **tiempo y por dificultad**: tres `GU.highScore(..., {lower:true})`
  distintos. Con el 0 por defecto de un marcador, la primera partida nunca sería
  récord.
- `padLeft` se calcula una vez por frame en un recorrido de las 81 casillas.
  Preguntarlo por cifra eran nueve recorridos, 729 iteraciones por frame.

## Nonograma (`nonograma/`)

- **Un patrón aleatorio casi nunca es un nonograma justo.** `logicallySolvable`
  resuelve línea a línea sin suponer nada, y `newGame` tira patrones hasta que
  uno pasa — es más barato repetir que intentar arreglar un patrón concreto. En
  la práctica salen 12 de 12 justos probando ~20 patrones, en 16 ms para 15×15.
  Hay un tope de 60 intentos para que una mala racha no bloquee la pestaña.
- `lineDeduce` enumera todas las colocaciones compatibles con lo ya sabido y
  devuelve **la intersección**: lo que sale pintado en todas y lo que sale vacío
  en todas. Eso es exactamente lo deducible de esa línea. Devuelve `null` si la
  línea es imposible.
- Una línea vacía da la pista `[0]`, no una lista vacía. El solucionador y el
  dibujo cuentan con ello.
- **Marcar con aspa no cuenta como error; pintar donde no toca sí.** Marcar es
  una nota del jugador, no una afirmación sobre el tablero.
- `randomPattern` pasa dos veces un suavizado tipo autómata celular y luego
  garantiza que ninguna fila ni columna quede vacía. Sin eso salen puzzles de
  confeti en vez de formas.

## Solitario (`solitario/`)

- **Las 52 caras y el dorso son sprites prerenderizados** (`GU.spriteSheet`).
  Una carta son ~4 paths y dos textos, y se repintan hasta 52 veces por frame;
  sin la caché son unas 200 llamadas de path por frame sólo para las esquinas.
- El dorso lleva un recorte: **el `clip` va antes de trazar las diagonales**. El
  `beginPath` que necesita el rectángulo de recorte descarta el path que hubiera,
  así que construirlas primero trazaba el rectángulo en vez de las líneas.
- `r` es el índice 0..12, así que el as es 0 y el rey 12. Las reglas quedan en
  aritmética directa (`card.r === onto.r - 1`) sin mapear nombres.
- **Deshacer guarda un snapshot completo**, no el inverso de cada jugada. Un mazo
  son 52 objetos diminutos: copiarlo es barato y evita escribir y depurar la
  operación inversa de cada tipo de movimiento, que es donde se esconden los bugs
  de un solitario. Tope de 200, como el sokoban.
- **El caso peor de una columna son 19 cartas** (6 tapadas más una escalera K..A).
  Con `FAN_DOWN = 24` y `FAN_HIDE = 11` la última acaba en y=632, dentro de los
  680 del canvas. Subir cualquiera de los dos vuelve a sacar la columna por abajo.
- Auto-completado cuando ya no queda ninguna carta tapada ni mazo: coloca una por
  tick para que se vea.

## Minigolf (`minigolf/`)

- **`concludeHole()` es el único sitio donde un hoyo suma al resultado**, lo
  hayas colado o te hayas quedado sin golpes. Tener dos caminos era justo lo que
  dejaba el par del hoyo fuera del total cuando se agotaba el tope, y el
  resultado final salía corto.
- El rebote contra un obstáculo se resuelve por el eje de **menor penetración**.
  Elegir el otro mete la bola dentro del rectángulo y la deja vibrando. El caso
  del centro exacto (sin normal) se empuja por el lado más cercano.
- **Para colar hay que llegar al hoyo Y no ir demasiado rápido.** Sin el límite
  de velocidad la bola entra siempre, y una de verdad pasa por encima.
- Los degradados de los obstáculos van **keyed por altura**: van de 24 a 260 px y
  uno construido para 26 dejaría los largos casi planos.
- El agua cuesta un golpe y devuelve a `lastX/lastY`, la posición desde la que se
  golpeó — no al tee.
- El récord es **golpes respecto al par**, puede ser negativo, y menor es mejor:
  `{lower: true}`.

## Bolos (`bolos/`)

- **El décimo frame no sigue la regla de los otros nueve.** No arrastra nada: sus
  tiradas extra ya *son* el bonus y se suman tal cual. Tratarlo como un frame
  normal es el error clásico y da 270 en una partida perfecta en vez de 300.
  Verificado contra los casos canónicos: perfecta 300, todo semiplenos de 5 = 150,
  nueve plenos y décimo abierto = 240.
- `strike` y `spare` se definen por el **tamaño del juego de bolos**, no por el
  número de tirada: pleno es limpiar los diez de una, semipleno limpiar lo que
  quedaba. Así valen también para las tiradas extra del décimo, donde `ball` ya
  no distingue.
- Los bolos **no se retiran durante una tirada**, sólo se marcan caídos, así que
  al empezar todos los de `gs.pins` estaban en pie y `rack - standing()` da los
  derribados sin recordar ningún "antes".
- `resetPins(cleared)` resuelve los tres casos del décimo de una vez: si la
  tirada vació la plataforma se monta un juego nuevo, y si no, se sigue con los
  que quedaban en pie.
- La simulación va en **coordenadas de pista** y sólo se proyecta al pintar, para
  que la física no dependa de la cámara. `proj()` interpola la anchura
  linealmente — no es una perspectiva real, pero a esta escala se lee igual y no
  tiene divisiones que puedan explotar.
- El efecto es una **aceleración** lateral, no una velocidad: con velocidad la
  trayectoria sería una recta en diagonal en vez de una curva.
- La bola se dibuja con `translate`/`scale` y se deshacen a mano. **No usa
  `setTransform`**: encima está la traslación de la sacudida y resetearla la
  anularía a mitad de frame.
- El canal (`gutter`) anula la tirada. Su bandera se limpia en `launch()`, no al
  puntuar, o el mensaje y el sonido se pisan entre sí.

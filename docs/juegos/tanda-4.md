# Tanda 4 — los diez de mesa y lógica

`inundacion`, `senku`, `timbiriche`, `escaleras`, `freecell`, `kakuro`,
`puentes`, `gatosupremo`, `bloques` y `backgammon`.

Los diez se escribieron **después** de sacar las piezas de mesa al toolkit
(`GU.idleScreen`, `GU.toast`, `GU.minimax`, `GU.cards`, `GU.drawDie`,
`GU.canvasButtons`) y todos usan `GU.rafDraw`, así que son la referencia de
cómo debería quedar un juego de tablero nuevo. Aquí sólo lo que no es evidente
leyendo el código.

## Inundación (`inundacion/`)

- **El límite de jugadas sale del tablero, no de una constante.** Se resuelve el
  tablero recién generado con una heurística glotona y el límite es ese
  resultado más un margen. Un número fijo es injusto en los dos sentidos: en un
  tablero fácil sobra tanto que el juego no existe, y en uno malo es imposible
  sin que el jugador pueda saberlo.
- Aquí sí vale sembrar al azar: **cualquier configuración se puede resolver**
  —basta con ir tiñendo— y lo único que cambia es cuánto cuesta. Eso es lo que
  mide el resolvedor.
- **La región se recalcula entera en cada jugada**, con una inundación desde la
  esquina. Llevar la frontera a mano es más rápido y es justo donde se cuelan
  los fallos: una casilla que entra por dos lados a la vez, o una que se queda
  fuera porque se visitó antes de teñirla.
- En `applyColor` se tiñe primero y se inunda después. Al revés —buscar vecinos
  del color nuevo y luego teñir— deja fuera las casillas que sólo quedan
  conectadas a través de las recién teñidas.

## Senku (`senku/`)

- **El tablero es una cruz, no un cuadrado**, así que hay tres estados por celda
  (NADA, HUECO, FICHA) y no un booleano. Confundir "fuera del array" con
  "casilla que no existe" permite encadenar saltos imposibles por la esquina.
- El salto exige **las tres condiciones a la vez**: distancia 2 en línea recta,
  ficha en medio y hueco al final. Quitar cualquiera lo convierte en otro juego.
- El final por bloqueo se detecta buscando **si queda algún salto legal**, no
  contando fichas: se puede perder con muchas fichas repartidas y sueltas.
- Deshacer guarda el tablero entero, como sokoban y solitario.

## Timbiriche (`timbiriche/`)

- **El turno extra es el juego**, y eso se traduce en una línea concreta del
  motor: `apply` devuelve el MISMO lado cuando la jugada cierra cuadro. Una IA
  que alterne el turno a ciegas no ve las cadenas — el mismo fallo que en
  mancala.
- **La profundidad se sube al final.** Con 40 líneas libres el árbol es
  impracticable y da igual, porque casi ninguna jugada temprana es mala; con
  pocas líneas es cuando se decide la partida.
- El evaluador castiga los cuadros que quedan a un solo lado de cerrarse: son
  los que el rival se lleva gratis en cuanto le toque.
- El toque elige la línea libre **cuyo centro cae más cerca**, no la que
  contiene el punto: entre dos líneas los rectángulos sensibles dejan huecos, y
  en un móvil eso son toques que no hacen nada.

## Serpientes y Escaleras (`escaleras/`)

- **Para entrar en la 100 hay que sacar el número exacto**; si te pasas, rebotas
  hacia atrás. Sin eso, quien llega antes a la zona alta gana casi siempre y el
  final no tiene tensión.
- Escaleras y serpientes son **fijas**, las del tablero clásico. Un tablero
  aleatorio no se puede leer de un vistazo.
- El recorrido va en bustrofedón y **`cellPos()` es el único sitio que lo sabe**:
  el resto del juego trabaja con el número de casilla.
- Las escaleras y serpientes se resuelven **al terminar la animación**, no al
  tirar. Resolverlo todo de golpe hace que la ficha aparezca ya al final del
  tobogán y se pierde lo único que este juego tiene que enseñar.

## FreeCell (`freecell/`)

- **Sólo se mueve una carta.** Lo que parece arrastrar una escalera es una
  cadena de movimientos usando celdas y columnas vacías. El máximo es
  `(celdas libres + 1) × 2^(columnas vacías)`, y **la columna de destino vacía
  no cuenta**: no puedes aparcar en el sitio donde vas a dejar la escalera. Es
  el detalle que casi todas las versiones caseras se saltan.
- **El abanico se estrecha cuando una columna crece.** Con paso fijo, una
  columna de 17 cartas —que sale sin esfuerzo aquí, porque se apila mucho más
  que en el solitario clásico— se sale del canvas y las últimas cartas quedan
  invisibles e intocables. Lo calcula la columna más larga, no cada una: si cada
  columna llevara su paso, la misma carta estaría a distinta altura según la
  vecina y el tablero bailaría en cada movimiento.
- El auto-completado sube una carta sólo cuando **ya no puede hacer falta
  abajo**, y `anyAuto()` está separado de `autoStep()` para poder preguntarlo
  sin mutar: el bucle de dibujo lo consulta para decidir si sigue pidiendo
  frames.

## Kakuro (`kakuro/`)

- **La unicidad no se puede dejar al azar.** Medido sobre 60 patrones por
  configuración, sólo entre el **0% y el 7%** de los tableros aleatorios tiene
  solución única — esperar a que salga uno, que es lo que hace futoshiki, aquí
  deja al generador sin tablero. Se fuerza: mientras haya más de una solución se
  revela una casilla, y después **se quitan las pistas que sobran**. Esa poda
  baja de 20 cifras dadas a 8 en el 9×9, que es la diferencia entre un puzzle
  medio resuelto y uno de verdad.
- **El patrón de negras se construye, no se siembra.** Toda casilla blanca tiene
  que estar en un tramo horizontal Y en uno vertical de dos o más; sembrando al
  azar quedan tantas sueltas que, al ennegrecerlas en cascada, el tablero se
  queda casi entero negro (medido: 17 blancas en un 9×9). Cada fila se corta en
  tramos de 2 a 5 —el rango de los kakuros publicados— y sólo después se limpia.
- **`countSolutions` va casilla a casilla, no permutando tramos.** La primera
  versión enumeraba las permutaciones de cada tramo horizontal, y un tramo de
  siete son 5040 por combinación: la pestaña se colgaba al generar. Las dos podas
  que lo hacen viable son la de la suma (lo que falta tiene que caber entre el
  mínimo 1+2+3… y el máximo 9+8+7… de las casillas restantes) y el corte cuando
  una casilla se queda sin candidatos.

## Puentes (`puentes/`)

- **El tablero se genera desde una solución**: se planta una isla y se van
  añadiendo vecinas tendiendo puentes, así que nace resoluble y conectado.
- **Dos islas nunca quedan pegadas.** El puente entre ellas no tendría ni una
  celda de largo y no se vería.
- El cruce de puentes se comprueba sobre **las celdas ocupadas**, no mirando
  sólo las islas de los extremos. Es el fallo clásico aquí.
- **Cumplir los números no es ganar**: hay que quedar además en una sola red. Se
  puede cerrar cada isla y dejar dos grupos independientes, y eso no es una
  solución — el juego lo dice en vez de callarse.

## Gato Supremo (`gatosupremo/`)

- **El estado incluye a dónde está obligado el que mueve** (`forced`). Sin ese
  dato la posición no está definida y la búsqueda evalúa posiciones que no
  existen.
- **Un tablero pequeño empatado no es de nadie pero queda cerrado.** Tratarlo
  como libre deja jugar en él para siempre.
- El evaluador **castiga mandar al rival a un tablero libre**: regalar la
  elección vale más que casi cualquier casilla, y es el error caro de este juego.
- La profundidad se ajusta al número de jugadas legales, que aquí no es el total
  de casillas libres sino las del tablero obligado — salvo cuando el rival queda
  libre, y entonces son hasta 81.

## Bloques (`bloques/`)

- **Se dan tres piezas y no llegan más hasta colocar las tres.** Con reposición
  inmediata se juega pieza a pieza y no hay nada que planificar.
- **El vaciado se calcula entero antes de aplicarlo.** Limpiando fila a fila, la
  segunda comprobación ve la rejilla ya modificada y una columna que estaba
  completa deja de estarlo por culpa de la fila recién limpiada. Es el fallo
  clásico de este juego.
- El final se comprueba **de verdad**, probando cada pieza en las 81 posiciones.
  Dar por perdida una partida que aún tenía hueco es la forma más rápida de que
  el juego parezca roto.
- La pieza se coloca **centrada en el toque**: agarrarla por su esquina superior
  izquierda obliga a apuntar a un sitio que no se ve.

## Backgammon (`backgammon/`)

- Un solo array de 24 enteros describe la posición: **positivo tuyo, negativo de
  la máquina**. Tú vas de la 23 a la 0 y la máquina al revés, así que "avanzar"
  es restar o sumar y las dos direcciones caben en la misma función.
- Las reglas que se implementan mal y aquí están: con ficha en la barra **no se
  mueve nada más** (es lo primero que mira el generador, no un caso añadido
  después); **los dobles se juegan cuatro veces**; y para sacar con un dado mayor
  que la distancia **no puede quedar ninguna ficha más atrás**.
- **Si sólo se puede jugar uno de los dos dados, hay que jugar el mayor.** Es la
  regla que casi nadie implementa. Se resuelve con `maxPlayable`, que prueba las
  secuencias y descarta las jugadas que desaprovechan dados; lleva un tope de
  nodos porque con dobles son cuatro dados y el árbol se dispara.
- La IA es **heurística, sin búsqueda profunda**: con dos dados aleatorios el
  árbol se abre en 21 tiradas por nivel y no compensa. Lo que decide partidas es
  no dejar fichas solas y hacer puntas seguidas, y eso lo puntúa la evaluación.
- Los dados que giran mientras se tira van en **otro array** (`animDice`):
  escribir sobre `dice` corrompería los dados disponibles del turno, que es
  estado de juego y no decoración.
- Verificado: **30 partidas aleatorias completas, ~7000 movimientos, cero
  violaciones** del recuento de 15 fichas por bando, y las 30 terminan.

# Tanda 3 — los que van llegando

Juegos añadidos después de los 64. Aquí sólo lo que no es evidente leyendo el
código.

## Apaga las Luces (`lightsout/`)

- **El tablero se genera desde el estado APAGADO**, aplicando pulsaciones al
  azar. Cualquier tablero construido así se apaga deshaciendo esas mismas
  pulsaciones, así que tiene solución por construcción. Sembrar luces al azar no
  vale: en un 5×5 sólo 1 de cada 4 configuraciones se puede apagar, y el jugador
  no podría distinguir «no lo veo» de «no se puede».
- Se pulsa un **subconjunto**, no un multiconjunto: pulsar dos veces la misma
  casilla se anula, así que repetir no aportaría nada y falsearía la cuenta de
  pulsaciones de referencia.
- Ojo con lo que NO garantiza: `solution.length` es *una* solución, no
  necesariamente la mínima — hay combinaciones que se cancelan entre sí. Sirve
  para la pista; el récord se compara contra lo que el jugador consiga.
- Como pulsar dos veces se anula y el orden da igual, la solución es un conjunto
  y no una secuencia. Por eso la pista puede señalar cualquier casilla pendiente.

## Tuberías (`tuberias/`)

- La red es un **árbol de expansión** sobre la rejilla, construido desde el
  depósito: conecta todas las celdas sin ciclos, así que la solución existe por
  construcción. Después se gira cada pieza al azar, y eso es todo el puzzle.
  Verificado: 900 de 900 árboles conectan todas las celdas en 5×5, 7×7 y 9×9.
- Cada celda guarda sus bocas como **cuatro bits** en sentido horario
  (arriba, derecha, abajo, izquierda). Girar es entonces rotar los bits una
  posición, y «¿encajan estas dos?» es mirar un bit en cada una. Sin tabla de
  tipos de pieza.
- La inundación exige que **las dos** celdas tengan boca hacia la otra.
  Comprobar sólo un lado deja pasar el agua por tuberías que no se tocan, que es
  el fallo clásico aquí.
- El recorrido en profundidad usa **pila explícita**. En 9×9 la versión
  recursiva son 81 marcos y aguantaría, pero así el techo de tamaño queda
  abierto.

## Cinco en Raya (`gomoku/`)

- **No hay minimax.** Con 225 casillas no sale a cuenta: la IA puntúa cada
  jugada por amenazas, mirando las cuatro direcciones.
- Distingue un tres **abierto** por los dos lados de uno tapado — valen 6000 y
  700. No distinguirlo es lo que hace que una IA de gomoku bloquee lo que no
  debe.
- Puntúa cada casilla **también desde el lado del rival** y se queda con el
  máximo. Sin eso hace lo de las IA malas: seguir con su línea mientras el humano
  completa la suya. Y es un *máximo*, no una suma: sumando, dos amenazas flojas
  pesan más que una mortal y ahí se pierde la partida.
- Los candidatos se limitan a casillas con una piedra a distancia 2. A media
  partida son unas 40 en vez de 200, y es lo que hace el turno instantáneo. En el
  tablero vacío no hay ninguna, así que la primera jugada se fuerza al centro.
- Comprobado contra los cuatro casos canónicos: bloquea un cuatro, remata el
  suyo propio, tapa un tres abierto y abre en el centro.

## Futoshiki (`futoshiki/`)

- **Solución única garantizada.** Se parte de un cuadrado latino completo, se le
  cuelgan las desigualdades *derivadas de él* —así son ciertas por definición y
  nunca se contradicen— y se van quitando pistas mientras `countSolutions`
  siga devolviendo 1. Sin esa comprobación salen puzzles con varias soluciones:
  el jugador rellena algo válido, el juego se lo da por malo y no hay forma de
  saber por qué.
- `countSolutions` **para en cuanto encuentra dos**. Contarlas todas sobre una
  rejilla casi vacía es exponencial; sólo hace falta saber si hay más de una.
  Y elige la casilla con menos candidatos (MRV), abandonando la rama en cuanto
  una se queda sin ninguno. Medido: 20/20 con solución única en cada dificultad,
  ~5 ms el 4×4, ~30 ms el 5×5, ~210 ms el 6×6.
- El cuadrado latino se construye por desplazamiento cíclico y luego barajando
  filas, columnas y símbolos. Las tres operaciones **conservan** la propiedad,
  así que sale válido sin backtracking. Verificado sobre 200.
- **`fits` sólo comprueba las desigualdades contra vecinas ya rellenas.** Con la
  vecina vacía no se puede decidir nada todavía, y exigirlo cortaría ramas
  válidas — es el fallo típico al escribir esa comprobación.
- **La punta del signo señala al MENOR.** Estuvo invertida y el tablero mostraba
  cosas como `5 < 2`; se vio mirando una captura, no leyendo el código. Ahora hay
  una comprobación que valida los 12 000 signos de 300 tableros contra su
  solución.

## Mancala (`mancala/`)

- Tablero de 14 posiciones: 0-5 hoyos del humano, 6 su granero, 7-12 los de la
  máquina, 13 el suyo. Con esa numeración **sembrar es avanzar el índice módulo
  14** y «el hoyo de enfrente» es `12 - i`, sin tablas de correspondencia.
- Las tres reglas que se implementan mal, y que aquí tienen prueba:
  - **Se salta el granero del rival** al sembrar. Sin eso el contador de semillas
    deja de cuadrar y el rival gana puntos que nadie le ha dado.
  - **Turno extra** si la última cae en tu granero. Es de donde salen las cadenas
    que deciden la partida.
  - **Captura** sólo si la última cae en un hoyo *tuyo* que estaba *vacío* y el de
    enfrente tiene semillas. Olvidar cualquiera de las dos condiciones convierte
    la captura en algo que pasa todo el rato.
- Al vaciarse un lado, el otro **recoge todo lo suyo**. Sin esa recogida el
  marcador final no suma las 48 semillas.
- El minimax lleva **de quién es el turno** en vez de alternar a ciegas: tras una
  jugada que repite, el que mueve no cambia. Ignorarlo es lo que hace que una IA
  de mancala no vea las cadenas, que es justo donde está el juego.
- Comprobado: 200 partidas aleatorias conservan las 48 semillas, y la IA a
  profundidad 6 gana 59 de 60 contra rival aleatorio alternando salida, con cero
  jugadas ilegales y unos pocos ms por turno.
- Las semillas se colocan en **espiral de ángulo áureo a partir del índice**,
  nunca con `Math.random()`: un frame repintado dos veces —como pasa en un
  resize— las movería de sitio.

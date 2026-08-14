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

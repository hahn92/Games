# Los diez de la segunda tanda

`tron`, `lunar`, `mastermind`, `generala`, `ciempies`, `bombas`, `domino`,
`mahjong`, `tiroalblanco` y `canastas`. Se escribieron ya con el toolkit
terminado, así que los diez usan `GU.controls`, `GU.hud` y `GU.highScore` sin
excepción — y son la referencia de cómo debería quedar un juego nuevo.

Aquí sólo lo que no es evidente leyendo el código.

## Estelas de Luz (`tron/`)

- **Es un juego de rejilla, no de píxeles.** Cada moto ocupa una celda entera y
  avanza de celda en celda a un tic fijo. Interpolar la posición para dibujar
  quedaría más suave pero abriría huecos donde el jugador cree que cabe y no
  cabe; con celdas, un pasillo de una celda es de una celda.
- Hay **dos bucles**: el de lógica es un `rafInterval` a tic fijo y el de render
  un `rafLoop` libre, para que el humo y la sacudida vayan suaves aunque las
  motos avancen a saltos.
- La IA mide **espacio abierto por inundación acotada**, no sólo el pasillo
  recto. Con `runway` solo, una moto se mete en un callejón largo y se mata ella
  sola; el flood fill distingue el pasillo cerrado del hueco que lleva a algún
  sitio. La deriva lateral pesa poco: se suma un +3 a seguir recto o la moto va
  dando bandazos.
- Todos avanzan **a la vez** y los choques se resuelven después, para que un
  frontal mate a los dos y no dependa del orden del bucle.
- El giro de 180° se compara contra `dir` (la dirección ya confirmada) y no
  contra `next`: comparando contra `next`, dos pulsaciones rápidas dentro del
  mismo tic cuelan la media vuelta y la moto choca con su propio rastro.
- Los rastros se pintan **una pasada por color**, no una por celda: son 3600
  celdas y cambiar `fillStyle` en cada una costaba más que todo el resto del
  frame.

## Alunizaje (`lunar/`)

- Los límites de posado (`MAX_LAND_VY`, `MAX_LAND_VX`, `MAX_LAND_ANGLE`) **son el
  juego**. Aflojarlos lo vuelve trivial.
- El perfil del terreno se genera y **después** se aplanan las plataformas. Al
  revés dejaba escalones de un píxel en los bordes por el redondeo, y ahí la
  nave chocaba contra una pared invisible justo al posarse.
- El combustible sobrante da puntos: es lo que premia frenar pronto y poco en
  vez de caer y frenar de golpe, que es la lección del original.
- Los laterales **envuelven**. Estrellarse contra un muro que no se ve es peor
  que reaparecer por el otro lado.

## Descifra el Código (`mastermind/`)

- **El recuento va en dos pasadas y no puede ir en una.** Primero las negras,
  marcando lo consumido en las dos listas, y luego las blancas sobre lo que
  queda. En una sola pasada, un intento con tres rojas contra un código con una
  sola roja devuelve tres blancas en vez de una.
- Se permiten colores repetidos: son 6⁴ = 1296 combinaciones. Prohibirlos lo
  dejaría en 360.
- El récord es el **menor** número de intentos, así que va con `{lower: true}`.
- `Enter` se ata **sin `preventDefault`**: también activa el botón que tenga el
  foco, y tragárselo dejaría los botones muertos para el teclado.

## Generala (`generala/`)

- La puntuación está verificada contra los casos canónicos: generala 50, full 25
  (y cinco iguales cuentan como full), escalera corta 30, larga 40, y trío/póker
  suman **todos** los dados, no sólo los repetidos.
- El **bono de 35 por sumar 63 arriba** es lo que da tensión a la mitad superior
  de la tabla. Sin él, malgastar los unos no tendría coste.
- La previsualización de lo que valdría cada casilla es lo que convierte esto en
  un juego de decisión y no de recordar la tabla.
- No se puede apuntar antes de tirar (`rollsLeft === MAX_ROLLS` bloquea), o el
  primer turno permitiría anotar cinco dados que nadie ha lanzado.

## Ciempiés (`ciempies/`)

- El cuerpo es una **lista de segmentos con posición propia**, no una cadena que
  sigue a la cabeza. Partirlo es entonces cortar el array en dos; con una cadena
  encadenada habría que rehacer los enlaces y ahí es donde se rompe.
- Cada segmento muerto **deja una seta**, y las setas desvían a los que vengan.
  El jugador construye el laberinto que le complica el nivel: ese es el motor de
  dificultad del original.
- Una seta aguanta cuatro tiros. Que cueste es lo que impide abrirse un pasillo
  cómodo disparando al suelo.
- Al llegar abajo el bicho **vuelve a la altura del jugador** en vez de salirse;
  si se saliera, el nivel se quedaría sin bicho y sin final.

## Bombas (`bombas/`)

- La explosión se calcula celda a celda desde el centro y **para en el primer
  bloque**, sin atravesarlo — muro o caja. Sin esa parada, una bomba en una
  esquina limpia medio mapa y el juego pierde la geometría.
- Los muros fijos van en cada celda con **fila y columna pares**. Esa rejilla es
  lo que impide que un nivel degenere en una sala abierta.
- La esquina de salida y sus dos vecinas se dejan **libres de cajas** siempre: sin
  ese hueco el jugador puede aparecer sin ninguna salida.
- Movimiento **por celdas**, como pacman. En píxeles libres, "¿estaba dentro de
  la llama?" pasa a ser una pregunta con respuesta ambigua.
- El pulso de la bomba sale de su propia mecha (`b.t`), no de `Math.random()`:
  el aviso va en el ritmo y el render se mantiene reproducible.

## Dominó (`domino/`)

- **La ficha se guarda como par ordenado `{a, b}` y la orientación se decide al
  colocarla.** El error clásico es guardarla ya girada y perder de vista cuál
  número era cuál; así los extremos jugables son siempre `chain[0].a` y
  `chain[último].b`.
- El pozo se construye con `b >= a`, o saldrían fichas duplicadas: el 3|5 y el
  5|3 son la misma.
- Sale quien tenga el **doble más alto**, y si no hay dobles la ficha más alta.
  Regla estándar, y evita el sorteo.
- La cadena se **escala** si no cabe en vez de serpentear. Doblarla en L queda
  bonito pero convierte el cálculo de los extremos en un problema de geometría.
- La máquina suelta primero las fichas de más puntos: en dominó, quedarse el
  doble seis cuando se cierra la partida es como se pierde.

## Mahjong Solitario (`mahjong/`)

- **Una ficha está libre si no tiene nada encima Y le queda libre el lado
  izquierdo o el derecho.** La segunda condición es la que hace que el montón se
  abra por los bordes, y es la que se implementa mal.
- **El reparto no es aleatorio.** Se llena la figura y se va vaciando de dos en
  dos eligiendo cada vez dos fichas libres *a la vez*; a esa pareja se le asigna
  el dibujo. Hacer esos movimientos en orden inverso es una partida válida, así
  que siempre hay solución. Sembrar fichas al azar sobre una figura da tableros
  imposibles a menudo y el jugador no puede saber si se equivocó o si le tocó uno
  malo.
  - Lo que se cuela fácil: no basta con ir quitando de arriba abajo. Si una ficha
    sólo queda libre **después** de retirar a su vecina, las dos nunca estuvieron
    disponibles al mismo tiempo y esa pareja no habría podido elegirse nunca.
  - Puede atascarse (dos fichas apiladas al final dejan sólo una libre), así que
    se reintenta, con tope de 60 como el nonograma. Medido tras arreglar la
    disposición: 100 de 100 repartos completos, y 92 de 100 se vacían incluso
    jugando siempre la primera pareja que aparece. Los 8 restantes piden pensar,
    que es de lo que va el juego.
- **Las coordenadas van en medias fichas, así que dos contiguas van a distancia
  2, no 1.** La media ficha es la unidad para poder desplazar una capa medio
  hueco; con paso 1 cada ficha tapa media vecina, la figura se apelotona y
  `isFree` deja de tener sentido, porque su idea de "pegada al lado" es
  exactamente una distancia de 2. Salió al mirar una captura: las 58 fichas
  amontonadas en un cuarto del tablero.
- **Las fichas van prerenderizadas.** Son 144 en pantalla y sólo 27 dibujos
  distintos —tres palos por nueve números—, así que el tablero entero sale de 54
  sprites como mucho, contando el estado libre/bloqueada. Medido con el contexto
  instrumentado: **820 operaciones de canvas por repintado, ahora 123**, y de
  esas 116 son los blits de las fichas.

  El borde de selección y el de la pista se quedan FUERA del sprite: cambian
  solos —la pista parpadea— y afectan a una o dos fichas, así que meterlos dentro
  multiplicaría los sprites por tres para ahorrarse dos trazos.

  Un aviso de método: medir esto desde la consola del navegador, contando
  operaciones por frame mientras se mueve el cursor, da un número **engañoso**
  —salió que la versión nueva gastaba más—, porque el juego vive en un IIFE y no
  hay forma de saber cuántas fichas ha repintado cada frame. La comparación buena
  es la de siempre: la misma sonda, el mismo arranque, antes y después.
- Al teclado sólo se le ofrecen las fichas **libres**: navegar por las
  bloqueadas no lleva a ninguna parte y multiplicaría por cuatro los pasos.

## Galería de Tiro (`tiroalblanco/`)

- **El cargador de seis balas y la recarga con coste son el juego.** Sin
  munición, la estrategia óptima es tocar la pantalla sin mirar.
- Fallar rompe la racha, y la racha multiplica en escalones (x2 a las 5, x3 a las
  10). Por eso dejar pasar una diana dudosa puede rentar más que dispararle.
- Las dianas se buscan **de atrás hacia delante** en el array, que es el orden de
  dibujo: si dos se solapan, le das a la que se ve encima.
- El balanceo vertical usa una fase fijada al nacer, nunca `Math.random()` en el
  dibujado.

## Canastas (`canastas/`)

- **El aro son dos postes sólidos, no una zona.** Es lo que hace que un tiro
  corto rebote en el hierro delantero y uno pasado se vaya contra el tablero.
  Tratarlo como un rectángulo "si entras, canasta" quita justo lo que tiene de
  bueno.
- Canasta = cruzar el plano del aro **hacia abajo y por dentro**, y sólo si antes
  se estuvo por encima (`wasAboveRim`). Sin esa condición, un balón que sube
  desde debajo del aro contaría al atravesarlo.
- La línea de puntería se integra con **la misma gravedad** que el tiro real. Si
  se dibujara con otra fórmula, la línea mentiría.
- El balón sale de un punto distinto cada vez: no hay una parábola que
  memorizar.

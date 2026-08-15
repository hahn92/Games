# Documentación

Guía técnica de la colección de 70 juegos. Empieza por aquí.

## Mapa

| Documento | Cuándo lo necesitas |
|-----------|---------------------|
| [Arquitectura](./arquitectura.md) | Qué hay en la raíz, qué hay dentro de un juego, catálogo completo |
| [Toolkit compartido](./toolkit.md) | `game-utils.js`: bucles, matemáticas, almacenamiento, partículas, HiDPI, accesibilidad — y por qué existe cada pieza |
| [Sonido](./audio.md) | `audio.js` y la llamada `GameAudio` que corresponde a cada evento |
| [Móvil y navegación](./movil.md) | `MobileLayout({...})`, la barra entre juegos, pantalla completa |
| [Rendimiento](./rendimiento.md) | Reglas de canvas y miniaturas del catálogo |
| [Trampas conocidas](./trampas.md) | Tres formas de romper un juego sin que salga ningún error |
| [Herramientas](./herramientas.md) | Comandos, subagentes, hooks y los patrones de IA |
| [Añadir un juego](./nuevo-juego.md) | Los pasos, en orden |
| [Notas por juego](./juegos/indice.md) | Los 54, con lo que no es evidente en cada uno |

## Rutas frecuentes

**Voy a crear un juego nuevo** → [Añadir un juego](./nuevo-juego.md), y de ahí a
[Toolkit](./toolkit.md) y [Móvil](./movil.md). Termina con `/validate-game`.

**Voy a tocar un juego que ya existe** → busca su fila en
[Notas por juego](./juegos/indice.md) *antes* de editar. Las notas registran
invariantes que se rompen sin avisar.

**Algo no se dibuja** → [Trampas conocidas](./trampas.md). Cargar no es dibujar.

**Va lento** → [Rendimiento](./rendimiento.md). Las reglas vienen de mediciones,
no de intuición.

**Quiero reutilizar algo en vez de reescribirlo** → [Toolkit](./toolkit.md). Cada
función de ahí sustituyó a una copia por juego; no vuelvas a implementarlas.

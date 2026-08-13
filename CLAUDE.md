# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

Colección de 64 juegos clásicos de navegador en JavaScript, HTML5 Canvas y CSS.
Sin build y sin dependencias: se abre cualquier `index.html` y funciona.
Desplegado en https://games.hahndev.com (ver `CNAME`).

```bash
npx serve .          # el catálogo
npx serve ./snake    # un juego suelto
```

## Dónde está cada cosa

La documentación vive en [`docs/`](./docs/indice.md), dividida por tema. Las
secciones de abajo se importan aquí, así que las tienes cargadas igualmente —
los enlaces son para navegar, no porque falte nada.

| Documento | Cuándo lo necesitas |
|-----------|---------------------|
| [Arquitectura](./docs/arquitectura.md) | Raíz, estructura de un juego, catálogo completo |
| [Toolkit compartido](./docs/toolkit.md) | `game-utils.js` y por qué existe cada pieza |
| [Sonido](./docs/audio.md) | Qué `GameAudio.*()` corresponde a cada evento |
| [Móvil y navegación](./docs/movil.md) | `MobileLayout({...})`, barra entre juegos, pantalla completa |
| [Rendimiento](./docs/rendimiento.md) | Reglas de canvas y miniaturas del catálogo |
| [Trampas conocidas](./docs/trampas.md) | Tres formas de romper un juego sin error en consola |
| [Herramientas](./docs/herramientas.md) | Comandos, subagentes, hooks, patrones de IA |
| [Añadir un juego](./docs/nuevo-juego.md) | Los pasos, en orden |
| [Notas por juego](./docs/juegos/indice.md) | Los 64, con lo que no es evidente en cada uno |

## Reglas que no se negocian

Estas cuatro rompen cosas en silencio. El detalle está en los documentos
enlazados; aquí queda lo que hay que recordar sí o sí.

1. **Nunca emoji en canvas.** `ctx.fillText()` con emoji provoca fallos de
   transparencia en algunos navegadores. Todo elemento de juego se dibuja con
   formas. → [Trampas](./docs/trampas.md)

2. **Cargar no es dibujar.** Un juego puede arrancar sin errores, con la lógica
   corriendo y la puntuación subiendo, y no pintar un solo frame. Confirma que
   el punto de entrada del render se alcanza de verdad. → [Trampas](./docs/trampas.md)

3. **Nunca llames a `adjustMobileLayout()` a mano.** Varios juegos registran su
   propio listener de `resize` y dependen de correr *después* del de
   `mobile-layout.js`. Redimensiona y lanza un evento `resize` real.
   → [Trampas](./docs/trampas.md)

4. **Los cinco scripts, en este orden, en todos los juegos.** Sin excepciones:
   un juego al que le falte alguno está incompleto.
   ```html
   <script src="../mobile-layout.js"></script>
   <script src="../audio.js"></script>
   <script src="../game-utils.js"></script>
   <script src="./main.js"></script>
   <script src="../fullscreen-btn.js"></script>
   ```

Y una de método: **no reimplementes nada que ya esté en `game-utils.js`**. Cada
función de ahí sustituyó a una copia por juego, y varias existen porque la
versión ingenua falla en Safari o con las cookies bloqueadas.
→ [Toolkit](./docs/toolkit.md)

## Contenido importado

@./docs/arquitectura.md
@./docs/toolkit.md
@./docs/audio.md
@./docs/movil.md
@./docs/rendimiento.md
@./docs/trampas.md
@./docs/herramientas.md
@./docs/juegos/arcade.md
@./docs/juegos/accion.md
@./docs/juegos/puzzle.md
@./docs/juegos/mesa.md
@./docs/juegos/reflejos.md
@./docs/juegos/nuevos.md
@./docs/juegos/nuevos-2.md
@./docs/juegos/transversales.md
@./docs/nuevo-juego.md

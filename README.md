# Games

49 juegos clásicos jugables en el navegador, hechos con JavaScript, HTML5 Canvas y
CSS puro. Sin build, sin dependencias, sin plugins.

**[games.hahndev.com](https://games.hahndev.com)**

## Ejecutar en local

No hay paso de compilación. Cualquier servidor estático sirve:

```bash
npx serve .          # el catálogo completo
npx serve ./snake    # un juego suelto
```

También funciona abriendo `index.html` directamente en el navegador.

> Si estás editando y no ves los cambios, suele ser la caché del navegador: sirve
> desde un puerto distinto o recarga forzando revalidación.

## Estructura

```
index.html        catálogo: búsqueda, filtros por categoría y paginación
main.js           lógica del catálogo, con URLs compartibles
thumbnails.js     una miniatura dibujada en canvas por juego
styles.css        sistema de diseño y layout compartido de las páginas de juego

game-utils.js     biblioteca compartida (ver abajo)
audio.js          sonido por Web Audio API, sin archivos
mobile-layout.js  adaptación a móvil: pantalla completa, escalado del canvas
fullscreen-btn.js barra de navegación entre juegos + botón de pantalla completa

<juego>/          index.html + main.js + styles.css
```

Cada juego es autocontenido en su carpeta y carga los cinco scripts compartidos en
este orden: `mobile-layout` → `audio` → `game-utils` → `main` → `fullscreen-btn`.

## `game-utils.js`

Biblioteca común a los 49 juegos. Lo relevante:

| Área | Qué aporta |
|------|-----------|
| **HiDPI** | Los canvas renderizan a la densidad real de la pantalla. `canvas.width` sigue devolviendo el tamaño lógico, así que la lógica de juego no se entera |
| **Almacenamiento** | `GameStore` en vez de `localStorage` a pelo. Nunca lanza: si el sitio tiene los datos bloqueados, cae a memoria en vez de tumbar el juego |
| **Compatibilidad** | Polyfill de `ctx.roundRect()`, que no existe antes de Safari 16.4 |
| **Partículas** | Pool reutilizable, sin asignaciones por frame |
| **Canvas** | Mapeo de puntero a coordenadas, memo de gradientes, rutas redondeadas |
| **Accesibilidad** | Operar tableros con teclado y anunciar los diálogos de fin de partida |
| **Bucle y utilidades** | Bucles sobre rAF, matemáticas, colisiones y color |

## Accesibilidad

- Cada enlace del catálogo lleva el nombre de su juego; las miniaturas son
  decorativas y quedan fuera del árbol de accesibilidad.
- Los tableros construidos con `<div>` (memorama, buscaminas, tres en raya,
  whack-a-mole) se manejan con teclado: una sola parada de tabulación por tablero,
  flechas para moverse y Enter o Espacio para actuar.
- Los diálogos de fin de partida se anuncian y reciben el foco.
- Contraste verificado contra WCAG AA.

**Pendiente:** los 40 juegos de canvas no tienen alternativa accesible. Etiquetar un
canvas no lo hace jugable — haría falta alternativa de teclado y anuncios de estado
por juego.

## Contribuir

La guía técnica está en **[`docs/`](./docs/indice.md)**, dividida por tema:

| | |
|---|---|
| [Arquitectura](./docs/arquitectura.md) | Raíz, estructura de un juego, catálogo |
| [Toolkit](./docs/toolkit.md) | `game-utils.js` y por qué existe cada pieza |
| [Sonido](./docs/audio.md) · [Móvil](./docs/movil.md) | Los dos sistemas compartidos |
| [Rendimiento](./docs/rendimiento.md) | Reglas de canvas, medidas no intuidas |
| [Trampas](./docs/trampas.md) | Tres formas de romper un juego sin error en consola |
| [Notas por juego](./docs/juegos/indice.md) | Los 49, con lo que no es evidente |
| [Añadir un juego](./docs/nuevo-juego.md) | Los pasos, en orden |

Antes de tocar un juego, busca su fila en las notas: registran invariantes que se
rompen sin avisar. `CLAUDE.md` en la raíz es el índice de todo esto.

## Licencia

Apache 2.0 — ver [LICENSE](LICENSE).

# Herramientas de desarrollo

## Pruebas

```bash
node game-utils.test.js    # el toolkit
node sw.test.js            # el service worker
```

Lo único del repo que se puede comprobar sin navegador. Cubre las piezas de
`game-utils.js` que tocan el DOM (`GU.controls`, `GU.hud`) cargándolas en un `vm`
con un doble de DOM escrito a mano — sin dependencias ni runner, porque este
proyecto no tiene build y no va a tenerlo. Sale con código 1 si algo falla.

No sustituye a mirar el juego: nada de esto detecta que un canvas no se pinte
(→ [Trampas](./trampas.md)).

## Lighthouse

```bash
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
pnpm dlx lighthouse http://localhost:8899/index.html --quiet \
  --chrome-flags="--headless --disable-gpu --no-sandbox" \
  --output=json --output-path=/tmp/lh.json \
  --only-categories=performance,accessibility,best-practices,seo
```

`pnpm dlx`, nunca `npx` — es la regla del entorno, y aquí además no queremos la
herramienta instalada: se usa un rato y se tira.

Estado a día de hoy: el catálogo saca **96 / 100 / 100 / 100** y los veinte
juegos auditados, **100 en accesibilidad**.

Lo que encontró y que no se veía de otra forma:

- **Un salto de diseño de 0,254** en el catálogo, casi todo culpa mía: el botón
  de «guardar sin conexión» nacía con `hidden` —que no ocupa sitio— y al
  mostrarlo empujaba el catálogo entero; y la barra de búsqueda y filtros se
  creaba desde `main.js` e insertaba antes de `<main>`, con el mismo efecto.
  Arreglado reservando el hueco de los dos: 0,254 → **0,076**, y la nota de
  rendimiento de 84 a 96.
- **Un `<span>` con `aria-label`** en la barra de navegación (la flecha apagada
  del primer y del último juego). Un elemento genérico sin rol no admite
  `aria-label`; y como esa flecha no lleva a ningún sitio, lo correcto es
  `aria-hidden`.
- **Contraste insuficiente en wordle**: los colores de siempre daban 3,81 el
  gris, 3,97 el verde y 2,63 el amarillo, contra el 4,5:1 que pide WCAG AA.

Lo que Lighthouse dice y aquí NO se sigue: minificar CSS y JavaScript. Este
proyecto se lee tal cual desde el navegador y no tiene build; minificar sería
cambiar eso por 80 KB.

## Ver los juegos sin extensión de navegador

Lo único que detecta que un canvas no pinta es mirarlo, y para eso no hace falta
nada instalado: Chrome captura en headless.

```bash
python3 -m http.server 8899 &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size=900,900 \
  --screenshot=tron.png \
  "http://localhost:8899/_harness.html?game=tron&w=900&h=900&keys=ArrowRight,ArrowUp"
```

`_harness.html` es lo que hace que la captura sea de una partida y no de la
pantalla de reposo: mete el juego en un iframe, pulsa Iniciar y luego inyecta las
teclas (`keys=`) y los clics en coordenadas de canvas (`clicks=200x300;150x400`)
que le pidas.

El iframe tiene que ser **ancho y visible**. Uno estrecho mete a `MobileLayout`
en su rama de móvil y uno fuera de pantalla hace que Chrome estrangule su `rAF`,
con lo que el juego no avanza ni un frame y la captura miente.
→ [Trampas](./trampas.md)

Para sondear valores en vez de mirar, `--dump-dom` sobre una página que escriba
lo que quieras en un `<pre>` sirve: así se localizó que el fondo de asteroids
salía en (145,152,173) cuando debía ser (13,27,75).

## Developer tools

### Skills (slash commands)
Located in `.claude/commands/`:

- `/validate-game [name]` — checks all quality criteria (sound, graphics, mobile, touch, code) for one or all games
- `/add-sounds [name]` — guides adding `GameAudio` calls to a specific game

### Subagents
Located in `.claude/agents/`:

- `game-validator` — validates a game against the full quality checklist
- `sound-auditor` — audits `GameAudio` coverage across all games
- `mobile-auditor` — audits mobile layout, canvas scaling, and touch handling

### Hooks
`.claude/settings.json` runs a code quality check after every `Edit`/`Write` on a `main.js` file. It warns about:
- `ctx.shadowBlur` inside a loop
- Emoji inside `ctx.fillText()`
- `setInterval` used as game loop without `requestAnimationFrame`
- `Math.random()` called inside a render function
- Missing `GameAudio` integration

## AI patterns used

- **Tic-tac-toe**: full minimax (no depth limit, 3×3 board is always tractable)
- **Connect Four**: minimax with alpha-beta pruning, depth 5; scoring by 4-cell windows in all directions, center column preference
- Both AIs respond after a short delay (300ms) for better UX

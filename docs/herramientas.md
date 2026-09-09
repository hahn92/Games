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

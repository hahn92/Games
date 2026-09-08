# Móvil y navegación

## Mobile support pattern

The whole pattern lives in **`mobile-layout.js`**. A game declares only what differs:

```html
<script src="../mobile-layout.js"></script>
<script>
MobileLayout({
    show: { mobileScore: 'block' },          // ids revealed on mobile, hidden on reset
    fit: function (vHeight) {                 // size the canvas/board
        var canvas = document.getElementById('myCanvas');
        var ratio = 400 / 620;
        var availableWidth  = window.innerWidth - 8;
        var availableHeight = vHeight - (isMobile() ? 50 : 0);
        var newHeight = Math.min(availableHeight, availableWidth / ratio);
        canvas.style.width  = newHeight * ratio + 'px';
        canvas.style.height = newHeight + 'px';
    },
    reset: function () {                      // undo `fit` on desktop
        var canvas = document.getElementById('myCanvas');
        canvas.style.width = ''; canvas.style.height = '';
    },
});
</script>
```

Optional keys: `onMobile(gameSide, vHeight)` / `onReset(gameSide)` for extra `gameSide`
setup (wordle), `mobileOnly: true` to skip the `innerWidth < 900` branch (snake, hangman),
`background` for a custom backdrop (pacman uses `'#000'`), `startBtn: false` to never
reveal `#mobileStartBtn` (hangman), `stopPropagation: true` (flappybird).

The module handles, once, for every game:

- `isMobile()` UA detection — exposed as the `window.isMobile` global (`snake/main.js` uses it)
- `adjustMobileLayout()` sets `gameSide` to `position: fixed`, fills the screen, hides `infoSide` — exposed as a global (`minesweeper/main.js` uses it)
- **Always uses `window.innerWidth + 'px'`** (not `'100vw'`) — on iOS Safari `100vw` can exceed the visual viewport
- Uses `window.visualViewport.height` (not `window.innerHeight`) for true mobile viewport height
- `resize` + `visualViewport.resize` + `DOMContentLoaded` listeners, and the `#mobileStartBtn` → `#startBtn` wiring

Remaining per-game conventions:

- **Canvas height offset ≤ 50px** — touch button panels are hidden globally via CSS; no large space reservation needed
- `#mobileScore` (absolute positioned) shows score overlay; uses `left: 5px; right: 5px` to stretch safely
- `#mobileStartBtn` overlays the canvas on initial load
- `fullscreen-btn.js` adds a floating ⛶ button (bottom-right) that triggers `requestFullscreen()` + `screen.orientation.lock('landscape')` (Android) or full-screen without lock (iOS)
- Bottom-anchored elements use `bottom: calc(20px + env(safe-area-inset-bottom))` for iPhone notch safety
- Touch controls (`.touch-controls`, `.touch-cols`) are **hidden globally** via `styles.css` with `display: none !important`; all games use swipe/tap gestures on canvas instead

## Navigation bar (`fullscreen-btn.js`)

**Every game MUST include the inter-game navigation bar.** It is provided by `fullscreen-btn.js`, which renders the navigation bar on all devices (and the fullscreen/landscape button on mobile). There are no exceptions — any new or existing game without it is considered incomplete.

La barra lleva ahora cuatro controles: anterior, catálogo, siguiente y **silencio**
(ver [Sonido](./audio.md)).

**Añadir el juego al array `GAMES` de `fullscreen-btn.js` es parte de crearlo.**
La barra se construye sólo si `findGameIndex()` encuentra la carpeta, así que un
juego que falte en ese array se queda sin barra — y como el juego funciona por lo
demás, no se nota salvo mirándolo. Pasó: la lista se quedó en 49 mientras el
catálogo llegaba a 70, y **21 juegos estuvieron sin navegación** (todos los de
sudoku en adelante). El orden del array es el del catálogo, porque de él salen el
anterior y el siguiente. Para comprobarlo de una vez:

```bash
node -e "
var fs=require('fs'), s=fs.readFileSync('fullscreen-btn.js','utf8');
var ids=[...s.match(/var GAMES = \[([\s\S]*?)\n    \];/)[1].matchAll(/\['([a-z0-9]+)'/g)].map(x=>x[1]);
var dirs=fs.readdirSync('.').filter(d=>fs.existsSync(d+'/main.js'));
console.log('sin barra:', dirs.filter(d=>!ids.includes(d)).join(' ')||'ninguno');"
```

To include it, add the script tag **last**, after `audio.js` and `main.js`:

```html
<script src="../mobile-layout.js"></script>
<script src="../audio.js"></script>
<script src="../game-utils.js"></script>
<script src="./main.js"></script>
<script src="../fullscreen-btn.js"></script>
```

When adding or reviewing a game, verify this script tag is present in `index.html`. `/validate-game` should be run to confirm.

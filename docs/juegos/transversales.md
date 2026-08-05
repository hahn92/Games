# Notas transversales

Estas notas describen un patrón compartido por varios juegos, no un juego suelto.

## Gemas (`gemas/`) and Plinko (`plinko/`)
- Both use `ctx.setTransform` for screen shake. That is the one call HiDPI has to
  intercept — the shared toolkit premultiplies it so the device-pixel scale survives.
- gemas integrates gravity *before* moving its particles, the opposite of every other
  per-frame loop here, which is why its particle system was left hand-rolled.

## Grid games played with the keyboard
`memorama`, `minesweeper`, `tictactoe` and `whackamole` build their boards from
`<div>`s. Each cell is wired with `GU.keyActivate`, and the board with
`GU.gridKeyboard` **after every render** — these games rebuild their cells on each
move, which destroys the focused element. `tictactoe` needs its own
`:focus-visible` rule because `.ttt-cell` overrides `outline`.

## Games on the shared particle pool
`airhockey`, `batallanaval`, `billar`, `breakout`, `catapulta`, `dardos`, `hanoi`,
`helicoidal`, `minero`, `misiles`, `platformer`, `pong`, `saltador`, `sopaletras`
and `stacktower`.

- Unit conversion differs per game. Loops with `dt` in seconds need velocity ÷60 and
  gravity ÷3600 — once for the velocity unit and once for the time unit. Loops with
  `dt` normalised to frames pass both through unchanged.
- `billar`, `catapulta`, `minero` and `stacktower` accelerate before moving, so their
  pools are `{semiImplicit: true}`.
- `saltador` and `helicoidal` damp only the horizontal velocity: `drag: [x, 1]`.
- `platformer` and `stacktower` draw their particles through a camera translate
  rather than offsetting each one.
- `misiles` keeps its state inside an IIFE, so nothing there is reachable from the
  console.

## Games whose particles stay hand-rolled
Not an oversight — the shared pool draws plain circles and squares with a linear
fade, and these need more: `fruitcatcher` shrinks each particle's radius with its
life, `spaceinvaders` nests particles per explosion and removes the explosion when
its array empties, `cosecha` draws a coin icon and other per-type shapes, `gemas`
integrates in the opposite order, `connectfour` and `flappybird` rotate their
particles, and `asteroids` and `pinball` use fragment shapes and per-particle glow.

## Games whose canvas is sized by their own `fit`
`damas`, `hanoi` and `reversi` compute the available width as
`window.innerWidth - 8`. The 8 is not decoration: their canvas carries a 3px border
per side with `content-box`, so using the raw `innerWidth` made the element 6px wider
than the viewport and the page scrolled sideways on a phone. `chess` uses the raw
value on purpose — its canvas only has a bottom border.

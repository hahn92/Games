# Mesa y cartas

Juegos con oponente o banca.

## Chess (`chess/`) and Damas (`damas/`)
- Both draw a 64-square board. The squares share one diagonal, so two origin-space
  gradients cover the whole board and each square is translated into place — building
  one per square meant ~70 gradients every frame.
- Piece gradients are memoised on `(cx, cy, size, colour)`. That is only safe because
  neither game animates pieces between squares: the coordinates are discrete.
- Their render loop is `requestAnimationFrame(function loop(ts) {...})`, a named
  function expression. A search for "loop referenced only inside itself" flags it as
  dead code; it is not.

## Connect Four (`connectfour/`)
- Discs use radial gradient for 3D sphere look + specular highlight
- Gravity-accelerated fall animation for piece placement
- Win particles burst from each of the 4 winning cells

## Blackjack (`blackjack/`)
- Every control is a **canvas-drawn rect** in `game.buttons`, rebuilt each frame by
  `buildButtons()`. There is no DOM button for pedir/plantarse/doblar and **no keyboard
  input at all** — this game is pointer-only, the sharpest accessibility gap in the set.
- Flow is driven by chained `setTimeout`, not the rAF loop; the loop only lerps cards
  toward their targets and draws.
- The deck is rebuilt and reshuffled on every `deal()`, so counting cards does nothing.
- Dealer draws below 17 and stands on any 17, soft included (`handTotal` already
  demotes aces). Blackjack pays 3:2 as `bet + floor(bet * 1.5)`.
- The hole card is dealer index 1, hardcoded in `syncSlots` and again in `drawCardSlot`
  for the flip; the flip is a horizontal `scale` through zero, not a real rotation.
- The bank persists and silently resets to 500 when it hits zero.

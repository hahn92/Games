# Palabras, ritmo y reflejos

Entrada por teclado o por toque a tiempo.

## Wordle (`wordle/`)
- On mobile: keyboard width set explicitly via JS (`Math.min(window.innerWidth - 16, 390) + 'px'`) to avoid iOS Safari overflow
- `gameSide.overflowX = 'hidden'` and `overflowY = 'auto'` set separately (shorthand `overflow` not supported everywhere)

## Typingspeed (`typingspeed/`)
- Two ways to advance: an exact match on the `input` event auto-advances after 80ms,
  or space/Enter submits. Space is never required.
- `endGame()` **replaces the popup's `innerHTML`, including `#playAgainBtn`**, then
  re-attaches a listener to the new node. The `playAgainBtn` handler registered at load
  is bound to an element that no longer exists after the first round — editing it has
  no effect.
- `totalAttempts` is clamped with `Math.max(totalAttempts, wordCount + 1)` so accuracy
  counts one attempt per word however many wrong keystrokes it took.
- WPM counts whole words, not the standard five characters. The final figure divides by
  `TIME_LIMIT`, the live one by elapsed time.
- The queue is padded past 300 entries so it cannot run dry, and in the last 20s
  upcoming entries are randomly swapped for `WORDS_HARD`.

## Hangman (`hangman/`)
- `SPANISH_ALPHABET` has **no Ñ** despite the name, and every word in the lists is
  unaccented (`JAPON`, `PINGUINO`). Adding an accented or Ñ word makes it unwinnable —
  there is no key to press.
- The gallows and body are drawn at **absolute pixel coordinates** (60, 190, 235…),
  not derived from canvas size. Only the base and pole read `H`. Resizing the canvas
  dislocates the figure, which is why this game runs `mobileOnly` with no start button.
- `#mScore` / `#mHighScore` are spans *inside* `#mobileScore` — a check that looks for
  `mobileScore.textContent =` will wrongly report this game as not updating its score.
- Iniciar resets the score, Reiniciar keeps it. Categories lock while a round is live.

## Simon (`simon/`)
- The colour pads are real `<button>`s driven by `disabled`, so keyboard and screen
  reader support come for free. It needs none of the `gridKeyboard` wiring the div-board
  games do.
- Note labels, the speed-mode line and the level badge are **injected from JS**, not in
  the HTML. `init()` runs from both `DOMContentLoaded` and immediately when the document
  is already parsed, so every injector guards against running twice.
- Three speed tiers keyed on round: ≤5, ≤10, above. Flash duration and gap both drop.

## Ritmo (`ritmo/`)
- A miss costs a life **both ways**: letting a tile cross the line, and tapping a lane
  with nothing in the window. Mashing is punished, which is the point.
- `MIN_LANE_GAP_PX` stops two tiles stacking in one lane, so a lane is always tappable
  once.
- Tile gradients run from `t.y` to `t.y + TILE_H` on a falling tile, so the key would
  be a moving coordinate — they cannot be memoised without leaking one gradient per
  frame. One per tile per frame is the floor; sub-elements use flat colours.

## Cambio de Color (`cambiocolor/`)
- Ring thickness is `RING_R - RING_r` = 40px against a 28px ball diameter. That margin
  is the entire anti-tunneling strategy — there is no swept-volume test. Thinning the
  ring or growing the ball puts the ball through a wall.
- The ball is pinned to `x = W/2` forever; only `y` moves. `checkRing` exploits this by
  treating the ball's angle as exactly ±π/2 rather than computing one.
- Sector edges carry a 0.18 rad forgiveness in both directions.
- Passing a ring always reassigns the ball a **different** colour, so the next ring is
  never a freebie.

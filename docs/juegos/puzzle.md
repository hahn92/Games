# Puzzle y lógica

Tableros por turnos, sin bucle de física.

## Tetris (`tetris/`)
- `randomPiece` draws from a **7-bag**: every piece appears exactly once per block of
  seven, so the longest possible wait is 13. It was uniform random until the bag landed.
- `rotate()` **has wall kicks** (`KICKS`): the rotated matrix is retried at a few lateral
  offsets and one row up before being discarded, so a piece flush against a wall or
  resting on the stack still turns. It does not phase through blocks — on a full board
  every candidate collides and the rotation is dropped.
- `drawBlock3D` reads its four bevel colours from `blockShades()`, a per-colour cache.
  Do not call `adjustColor()` from the draw path: a full board is 200 blocks and it was
  re-deriving 800 colour strings per frame.
- Line clearing is two-phase on purpose — `clearLines` marks and starts the animation,
  `executeClearLines` removes the rows and awards the score.
- Speed is `max(80, 500 - (level-1) * 48)`; both the line score and the combo bonus
  multiply by `level`, so changing the level curve rescales the whole score.

## 2048 (`2048/`)
- `board` is initialised full of zeros at module level because the `render()` at the
  bottom of the file runs on load, before `startGame` ever builds a board.
- In `slide`, the merge animation index is `out.length - 1` — the tile's position
  *after* compaction. Using the pre-compaction loop index marks the wrong cell whenever
  a line merges twice (`[2,2,2,2] → [4,4]` lit an empty cell).
- The floating `+points` is appended to `gameSide`, not to `#game2048`: `render()`
  wipes the board container's `innerHTML` on every move and would delete it mid-animation.
- Swipes are captured on the whole `gameSide` — on a phone the grid is a fraction of
  the screen and gestures starting off it were being lost.

## Slidingpuzzle (`slidingpuzzle/`)
- The board is shuffled by **1000 random legal moves from the solved state**, never by
  permuting the tiles. Half of all permutations of a 15-puzzle are unsolvable; this
  construction cannot produce one.
- Arrow keys move the *empty* cell, so they read inverted against the tile: `ArrowUp`
  pulls the tile below the gap upward.
- `SIZE` is mutable (3/4/5) and records are stored per size.
- The size selector, hint button and records panel are injected from JS.

## Sokoban (`sokoban/`)
- Levels are standard Sokoban notation (`#$.*+@` and space), so puzzles from elsewhere
  paste in unchanged.
- Statics and dynamics share ONE grid: 2 = target, 4 = box on target, 6 = player on
  target. That encoding is what lets a cell restore to 2 instead of 0 when something
  steps off it. There is no separate target layer to consult.
- `checkWin` tests "no cell is 3" — no box *off* a target — not "every target is
  filled". **Levels 4, 5 and 6 ship with one more target than boxes** and are winnable
  precisely because of that; a win check written the other way would make them
  impossible.
- Undo pushes a deep grid copy per move, capped at 200.

## Laberinto (`laberinto/`)
- `dfsMaze` is **recursive**, one frame per cell in the worst case: 675 deep at level
  10 (25×27). Fine today, but that is the ceiling on level size — a much larger grid
  needs an explicit stack.
- The `LEVELS` comment claims odd dimensions are needed "so DFS borders work cleanly".
  That is vestigial: this is a cell-based backtracker where each cell carries its own
  `t/r/b/l` walls, not a grid-of-walls algorithm. Even sizes would work.
- Start is always `(0,0)`, exit always `(cols-1, rows-1)`.
- The clock starts on the **first move**, not on Iniciar.
- `checkWin` reads the previous best **before** calling `saveBest` and compares
  strictly. Comparing afterwards means comparing against the value you just wrote,
  which is what forced the old `< 50ms` tolerance and reported false records on a
  near-tie. Keep the read before the write.
- `getBest()` cachea el objeto de récords y sólo lo tira en `saveBest`. `drawHUD()`
  lo llama en cada frame, así que sin caché eran 60 `JSON.parse` por segundo del
  objeto entero. Si algún día otra cosa puede escribir los récords, tiene que
  invalidar `bestsCache` también.
- Las cuatro escrituras de DOM de `drawHUD()` van por `GU.hud`. Se le pasa el texto
  ya formateado (`fmtTime(elapsedMs)`), no los milisegundos: en crudo cambian en
  cada frame y el filtro no filtraría nada.

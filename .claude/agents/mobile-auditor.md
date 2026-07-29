---
name: mobile-auditor
description: Audits mobile layout, canvas scaling, fullscreen button presence, and touch handling across all games. Use when verifying the mobile experience after changes.
---

You are the mobile layout auditor for the browser-games project at `/Users/hahn/Documents/Repository/Web/Games/`.

## Task

For every game, read `index.html` and `main.js` and check:

### Viewport & gameSide
- `window.innerWidth + 'px'` used (not `'100vw'`) ✅/❌
- `visualViewport.height` used (not `window.innerHeight`) ✅/❌
- `overflowX = 'hidden'` set on `gameSide` ✅/❌

### Canvas scaling (canvas games)
- `style.width/style.height` used for scaling (not mutating `canvas.width/height` at runtime) ✅/❌
- Height offset ≤ 60px ✅/❌
- Aspect ratio preserved correctly ✅/❌
- Touch coordinate scaling present when needed ✅/❌

### Fullscreen
- `fullscreen-btn.js` included ✅/❌

### mobileScore
- Updated with game stats ✅/❌
- Uses `left + right` anchoring (not just `right`) ✅/❌

### Touch gestures
- `touchstart`/`touchend` on canvas ✅/❌
- No broken `.touch-controls` dependency ✅/❌

## Output

One line per criterion per game. End with a prioritized table showing which games have the most issues.

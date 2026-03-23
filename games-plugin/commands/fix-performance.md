---
description: Scan a game's main.js for canvas performance anti-patterns and fix them. Pass the game folder name.
---

# Fix Performance — "$ARGUMENTS"

Scan `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/main.js` for the performance anti-patterns below and fix each one found.

## Anti-patterns to find and fix

### 1 — shadowBlur inside a draw loop

Find `ctx.shadowBlur` assignments inside `forEach`, `for`, or `while` loops that iterate over game objects. Move the state set/reset outside the loop:

```js
// Before (bad)
aliens.forEach(function(a) { ctx.shadowBlur = 10; drawAlien(a); });

// After (good)
ctx.shadowBlur = 10;
aliens.forEach(function(a) { drawAlien(a); });
ctx.shadowBlur = 0;
```

### 2 — Math.random() inside draw/render functions

Move random value generation to spawn/init time and store on the object:

```js
// Before (bad — called every frame)
function drawParticle(p) { ctx.globalAlpha = Math.random(); ... }

// After (good — computed once at spawn)
function spawnParticle() { return { alpha: Math.random(), ... }; }
function drawParticle(p) { ctx.globalAlpha = p.alpha; ... }
```

### 3 — setInterval as game loop without rAF

Replace with `requestAnimationFrame` + delta-time throttle:

```js
var lastTime = 0;
function loop(ts) {
    var dt = ts - lastTime;
    if (dt < 15) { requestAnimationFrame(loop); return; }
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

### 4 — Gradient recreated every frame

Cache the gradient object; only rebuild when canvas dimensions change:

```js
var _grad = null;
function getGrad() {
    if (!_grad) {
        _grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        _grad.addColorStop(0, '#8fd3f4');
        _grad.addColorStop(1, '#ff512f');
    }
    return _grad;
}
```

### 5 — ctx.save()/ctx.restore() inside tight loops

Only save/restore when you truly need to isolate a transform. For simple color/alpha changes, set and reset the property directly.

## Output

List every issue found with its line number, show the before/after fix, then confirm each change was applied.
Run `/games:validate-game $ARGUMENTS` at the end to verify no regressions.

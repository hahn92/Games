---
description: Scan a game's main.js for canvas performance issues and fix them. Pass the game folder name.
---

# Fix Performance — "$ARGUMENTS"

Scan `/Users/hahn/Documents/Desarrollo/Games/$ARGUMENTS/main.js` for performance problems and fix them.

## What to look for and fix

### shadowBlur in loops

Bad:
```js
aliens.forEach(function(a) {
    ctx.shadowBlur = 10;   // ← expensive per element
    ctx.shadowColor = '#f00';
    drawAlien(a);
});
```

Good:
```js
ctx.shadowBlur = 10;
ctx.shadowColor = '#f00';
aliens.forEach(function(a) { drawAlien(a); });
ctx.shadowBlur = 0;
```

### Math.random() in render path

Move any `Math.random()` call inside draw/render functions to the spawn/init step instead. Store the value on the object.

### setInterval as game loop

Replace `setInterval(loop, 16)` with `requestAnimationFrame` + delta-time throttle:

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

### Gradient recreation every frame

Cache gradients and only recreate when dimensions change:

```js
var cachedGrad = null;
function getGrad() {
    if (!cachedGrad) cachedGrad = ctx.createLinearGradient(0, 0, W, 0);
    return cachedGrad;
}
```

### ctx.save()/ctx.restore() in tight loops

Replace with explicit state save/restore of only the properties that change.

## Output

List every issue found, the line number, and confirm each fix applied. Run `/validate-game $ARGUMENTS` afterward to verify.

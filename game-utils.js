// Shared game utilities — include before main.js:
//   <script src="../game-utils.js"></script>

// rAF-based interval: same tick semantics as setInterval but synced to the display.
// Use for fixed-tick game loops (snake, tetris, pong, ...). Stop with rafClear().
function rafInterval(fn, ms) {
    const handle = { id: 0, stop: false };
    let last = performance.now();
    function loop(ts) {
        if (handle.stop) return;
        handle.id = requestAnimationFrame(loop);
        if (ts - last >= ms) {
            last = ts - ((ts - last) % ms);
            fn();
        }
    }
    handle.id = requestAnimationFrame(loop);
    return handle;
}

function rafClear(handle) {
    if (handle) { handle.stop = true; cancelAnimationFrame(handle.id); }
}

/* audio.js — Shared Web Audio API sound system for all games
 * No external files needed. Pure oscillator/noise synthesis.
 * Usage: GameAudio.score(), GameAudio.gameOver(), etc.
 */
var GameAudio = (function () {
    'use strict';
    var ctx = null;
    var master = null;
    var muted = false;
    var unlocked = false;

    function init() {
        if (ctx) return true;
        try {
            var AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.35;
            master.connect(ctx.destination);
            return true;
        } catch (e) { return false; }
    }

    function unlock() {
        if (!ctx || unlocked) return;
        if (ctx.state === 'suspended') ctx.resume();
        unlocked = true;
    }

    // Unlock on first user gesture (required by iOS Safari)
    ['touchstart', 'mousedown', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, function () { init(); unlock(); }, { passive: true });
    });

    function safe(fn) {
        try { if (init()) { unlock(); fn(); } } catch (e) {}
    }

    /* --- Low-level primitives --- */
    function osc(type, freq, t, dur, vol, endFreq) {
        if (muted || !ctx) return;
        var g = ctx.createGain();
        g.connect(master);
        g.gain.setValueAtTime(vol || 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        var o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 0.01);
    }

    /* One white-noise buffer, built once and reused. Filling a fresh buffer per
     * call meant a Math.random() loop over thousands of samples on every
     * explosion — allocation and GC pressure in the middle of gameplay.
     * Variation comes from starting at a random offset instead. */
    var noiseBuf = null;
    var NOISE_SECONDS = 2;

    function getNoiseBuffer() {
        if (noiseBuf) return noiseBuf;
        var len = Math.ceil(ctx.sampleRate * NOISE_SECONDS);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return noiseBuf;
    }

    function noise(t, dur, vol) {
        if (muted || !ctx) return;
        var buf = getNoiseBuffer();
        /* clamp so offset + dur never runs past the end of the buffer */
        dur = Math.min(dur, NOISE_SECONDS);
        var offset = Math.random() * (NOISE_SECONDS - dur);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var g = ctx.createGain();
        g.gain.setValueAtTime(vol || 0.15, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(g);
        g.connect(master);
        src.start(t);
    }

    /* --- Public sound library --- */
    return {
        // ── Scoring / positive ──────────────────────────────────────────
        score: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 523, t, 0.06, 0.22);
                osc('square', 784, t + 0.07, 0.09, 0.2);
            });
        },
        scoreHigh: function () {          // combo / milestone
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 523, t,      0.05, 0.18);
                osc('square', 659, t+0.06, 0.05, 0.18);
                osc('square', 784, t+0.12, 0.05, 0.18);
                osc('square', 1047,t+0.18, 0.10, 0.22);
            });
        },

        // ── Win / fanfare ───────────────────────────────────────────────
        win: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 262, t,      0.08, 0.22);
                osc('square', 330, t+0.09, 0.08, 0.22);
                osc('square', 392, t+0.18, 0.08, 0.22);
                osc('square', 523, t+0.27, 0.08, 0.22);
                osc('square', 659, t+0.38, 0.25, 0.28);
            });
        },

        // ── Game over / failure ─────────────────────────────────────────
        gameOver: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('sawtooth', 392, t,      0.14, 0.28);
                osc('sawtooth', 311, t+0.15, 0.14, 0.28);
                osc('sawtooth', 261, t+0.30, 0.14, 0.28);
                osc('sawtooth', 196, t+0.46, 0.25, 0.28);
            });
        },

        // ── Start / level begin ─────────────────────────────────────────
        start: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 220, t,      0.10, 0.22, 440);
                osc('square', 330, t+0.12, 0.10, 0.22, 660);
            });
        },

        // ── Click / menu / key press ────────────────────────────────────
        click: function () {
            safe(function () {
                osc('square', 480, ctx.currentTime, 0.04, 0.12);
            });
        },

        // ── Jump / upward move ──────────────────────────────────────────
        jump: function () {
            safe(function () {
                osc('square', 220, ctx.currentTime, 0.09, 0.2, 660);
            });
        },

        // ── Hop (Frogger-style short move) ──────────────────────────────
        hop: function () {
            safe(function () {
                osc('square', 300, ctx.currentTime, 0.06, 0.18, 540);
            });
        },

        // ── Hit / bounce (paddle, wall) ─────────────────────────────────
        hit: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 400, t, 0.04, 0.28, 80);
                noise(t, 0.03, 0.08);
            });
        },

        // ── Paddle hit (Pong / Breakout) ────────────────────────────────
        paddle: function () {
            safe(function () {
                osc('square', 440, ctx.currentTime, 0.04, 0.3);
            });
        },

        // ── Brick break ──────────────────────────────────────────────────
        brick: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 600, t, 0.03, 0.22, 300);
                noise(t, 0.04, 0.1);
            });
        },

        // ── Piece land / drop (Tetris) ──────────────────────────────────
        place: function () {
            safe(function () {
                osc('sine', 660, ctx.currentTime, 0.06, 0.2, 220);
            });
        },

        // ── Line clear (Tetris) ─────────────────────────────────────────
        lineClear: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('sawtooth', 440, t,      0.05, 0.28);
                osc('sawtooth', 554, t+0.07, 0.05, 0.25);
                osc('sawtooth', 659, t+0.13, 0.05, 0.28);
                osc('sawtooth', 880, t+0.19, 0.13, 0.32);
            });
        },

        // ── Shoot / laser ────────────────────────────────────────────────
        shoot: function () {
            safe(function () {
                osc('sawtooth', 880, ctx.currentTime, 0.08, 0.2, 180);
            });
        },

        // ── Explosion ────────────────────────────────────────────────────
        explode: function () {
            safe(function () {
                var t = ctx.currentTime;
                noise(t, 0.28, 0.38);
                osc('sawtooth', 100, t, 0.22, 0.3, 30);
            });
        },

        // ── Splash / water death (Frogger) ──────────────────────────────
        splash: function () {
            safe(function () {
                var t = ctx.currentTime;
                noise(t, 0.22, 0.22);
                osc('sine', 180, t, 0.18, 0.2, 60);
            });
        },

        // ── Reach goal / lily pad ─────────────────────────────────────
        goal: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 523, t,      0.07, 0.22);
                osc('square', 659, t+0.08, 0.07, 0.22);
                osc('square', 784, t+0.16, 0.12, 0.28);
            });
        },

        // ── Card flip (Memorama) ─────────────────────────────────────────
        flip: function () {
            safe(function () {
                osc('sine', 740, ctx.currentTime, 0.07, 0.14, 370);
            });
        },

        // ── Match found ──────────────────────────────────────────────────
        match: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 600, t,      0.06, 0.18);
                osc('square', 800, t+0.07, 0.08, 0.18);
            });
        },

        // ── No match / error ─────────────────────────────────────────────
        noMatch: function () {
            safe(function () {
                osc('sawtooth', 280, ctx.currentTime, 0.1, 0.22, 180);
            });
        },

        // ── Tile slide (Sliding Puzzle / 2048) ───────────────────────────
        slide: function () {
            safe(function () {
                osc('sine', 500, ctx.currentTime, 0.04, 0.12, 320);
            });
        },

        // ── Merge tiles (2048) ──────────────────────────────────────────
        merge: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 440, t,      0.04, 0.15);
                osc('square', 660, t+0.05, 0.06, 0.15);
            });
        },

        // ── Simon button tones (4 distinct notes) ───────────────────────
        simon: function (index) {
            var freqs = [261.6, 329.6, 392.0, 523.3]; // C4 E4 G4 C5
            safe(function () {
                osc('sine', freqs[index] || 261.6, ctx.currentTime, 0.45, 0.5);
            });
        },

        // ── Whack! (hit mole) ─────────────────────────────────────────
        whack: function () {
            safe(function () {
                var t = ctx.currentTime;
                noise(t, 0.07, 0.3);
                osc('square', 200, t, 0.06, 0.25, 80);
            });
        },

        // ── Miss (whack-a-mole) ──────────────────────────────────────────
        miss: function () {
            safe(function () {
                osc('sawtooth', 300, ctx.currentTime, 0.08, 0.18, 200);
            });
        },

        // ── Mine explode (Minesweeper) ───────────────────────────────────
        mine: function () {
            safe(function () {
                var t = ctx.currentTime;
                noise(t, 0.35, 0.45);
                osc('sawtooth', 120, t, 0.28, 0.32, 35);
            });
        },

        // ── Reveal cell (Minesweeper) ────────────────────────────────────
        reveal: function () {
            safe(function () {
                osc('sine', 440, ctx.currentTime, 0.04, 0.1);
            });
        },

        // ── Type letter (Wordle / Typing Speed) ──────────────────────────
        type: function () {
            safe(function () {
                osc('square', 540, ctx.currentTime, 0.03, 0.1);
            });
        },

        // ── Correct word / green tile ────────────────────────────────────
        correct: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 659, t,      0.05, 0.18);
                osc('square', 880, t+0.06, 0.07, 0.18);
            });
        },

        // ── Present / yellow tile ────────────────────────────────────────
        present: function () {
            safe(function () {
                osc('square', 500, ctx.currentTime, 0.05, 0.16);
            });
        },

        // ── Absent / grey tile ───────────────────────────────────────────
        absent: function () {
            safe(function () {
                osc('sawtooth', 250, ctx.currentTime, 0.05, 0.14, 180);
            });
        },

        // ── Power-up / fruit catch ───────────────────────────────────────
        powerUp: function () {
            safe(function () {
                var t = ctx.currentTime;
                osc('square', 440, t,      0.04, 0.18);
                osc('square', 660, t+0.05, 0.04, 0.18);
                osc('square', 880, t+0.10, 0.07, 0.2);
            });
        },

        // ── Bomb (Fruit Catcher) ─────────────────────────────────────────
        bomb: function () {
            safe(function () {
                var t = ctx.currentTime;
                noise(t, 0.32, 0.42);
                osc('sawtooth', 80, t, 0.26, 0.32, 28);
            });
        },

        // ── Tick (timer warning) ─────────────────────────────────────────
        tick: function () {
            safe(function () {
                osc('square', 900, ctx.currentTime, 0.02, 0.08);
            });
        },

        // ── Mute control ─────────────────────────────────────────────────
        setMuted: function (m) { muted = !!m; },
        isMuted:  function ()  { return muted; },
        toggleMute: function () { muted = !muted; return muted; }
    };
}());

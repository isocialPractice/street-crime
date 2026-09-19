// js/entities/breakfx.js — BreakFX splinter burst thrown when a crate gives way
// Lives in the same 'effects' array as HitFX and follows the same contract:
// constructed at the moment of the break, update(dt) every frame, dropped once
// the 'done' getter turns true.
//
// The shards are drawn rather than sprited. A crate breaks in a different spray
// every time and a handful of rotating quads costs nothing next to loading a set
// of debris images.

// Splinter colours, sampled from the crate art so the debris matches the box it
// came out of: lit face, shadowed slat, and the near-black of a fresh split.
const BREAKFX_COLORS = ['#a67cac', '#8f5e7e', '#7c5587', '#5c3f6f', '#2b2f75', '#19112f'];

class BreakFX {
    constructor(wx, wy, count = CFG.objBreakFxCount) {
        this.wx = wx; this.wy = wy;
        this.max = CFG.objBreakFxTime;
        this.t   = this.max;

        // Shards are thrown in a fan biased upward and outward. Storing the
        // velocity per shard and integrating it keeps the spray different on
        // every break without any per-frame randomness (which would make the
        // debris jitter instead of fly).
        this.shards = [];
        const n = Math.max(0, Math.round(count));
        for (let i = 0; i < n; i++) {
            const ang   = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.25;
            const speed = 90 + Math.random() * 190;
            this.shards.push({
                x:    (Math.random() - 0.5) * 18,
                y:    (Math.random() - 0.5) * 22,
                vx:   Math.cos(ang) * speed,
                vy:   Math.sin(ang) * speed,
                rot:  Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 14,
                w:    3 + Math.random() * 6,
                h:    2 + Math.random() * 5,
                col:  BREAKFX_COLORS[(Math.random() * BREAKFX_COLORS.length) | 0],
            });
        }
    }

    get done() { return this.t <= 0; }

    update(dt) {
        this.t -= dt;
        for (const s of this.shards) {
            // Half gravity: real gravity drags the debris off screen before the
            // burst has had a chance to read at this effect length.
            s.vy += CFG.gravity * 0.5 * dt;
            s.x  += s.vx * dt;
            s.y  += s.vy * dt;
            s.rot += s.spin * dt;
        }
    }

    draw() {
        // Everything fades on the same curve, with the dust puff dying first so
        // the shards are still readable over the broken crate at the end.
        const a = Math.max(0, this.t / this.max);
        const ox = this.wx - cam.x;

        ctx.save();
        if (a > 0.45) {
            const p = (a - 0.45) / 0.55;
            ctx.globalAlpha = p * 0.35;
            ctx.fillStyle   = '#cbb9d6';
            ctx.beginPath();
            ctx.ellipse(ox, this.wy, 26 + (1 - p) * 26, 16 + (1 - p) * 16, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = a;
        for (const s of this.shards) {
            ctx.save();
            ctx.translate(ox + s.x, this.wy + s.y);
            ctx.rotate(s.rot);
            ctx.fillStyle = s.col;
            ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
            ctx.restore();
        }
        ctx.restore();
    }
}

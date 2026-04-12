// js/entities/hitfx.js — HitFX short-lived impact particle
// Created on hit, updated every frame, removed when t <= 0 (the 'done' getter).
// wx/wy are stored in world space so the effect stays anchored if the camera moves.

class HitFX {
    constructor(wx, wy, type = 'small') {
        this.wx   = wx; this.wy = wy;
        this.type = type;
        const dur = { small:0.25, medium:0.3, hard:0.45 };
        const sz  = { small:38,   medium:52,  hard:72   };
        this.max  = dur[type] || 0.3;
        this.t    = this.max;
        this.size = sz[type] || 40;
    }

    get done() { return this.t <= 0; }

    get img()  {
        if (this.type === 'small')  return EFFECTS.small;
        if (this.type === 'hard')   return EFFECTS.hard;
        return EFFECTS.medium;
    }

    update(dt) { this.t -= dt; }

    draw() {
        // 'a' goes 1.0 → 0.0 (fades out); 's' goes 1.0 → 1.4 (grows as it fades).
        // The combination produces a classic impact pop effect.
        const a = this.t / this.max;
        const s = 1 + (1 - a) * 0.4;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(this.wx - cam.x, this.wy);
        ctx.scale(s, s);
        ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

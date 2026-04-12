// js/entities/breakable.js — Breakable crate / barrel
// IMPORTANT coordinate convention: BreakableObj.y is the BOTTOM of the sprite
// (ground contact point). The sprite is drawn UPWARD from y - h to y.
// This differs from Entity where y is the sprite top.

class BreakableObj {
    constructor(wx, wy) {
        this.x = wx; this.y = wy;
        this.broken = false;
        this.w = 48; this.h = 56;
    }

    smash(effects, pickups) {
        if (this.broken) return;
        this.broken = true;
        effects.push(new HitFX(this.x + 24, this.y - 20, 'medium'));
        // Drop chance controlled by CFG.objBreakDropChance (default 65%).
        if (Math.random() < CFG.objBreakDropChance)
            pickups.push(new Pickup(this.x + 8 + Math.random() * 28, this.y - 10, 'health'));
    }

    draw() {
        const img = this.broken ? OBJECTS.broken : OBJECTS.intact;
        const sx  = this.x - cam.x;
        ctx.drawImage(img, sx, this.y - this.h, this.w, this.h);
    }
}

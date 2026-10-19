// js/entities/breakable.js — Breakable crate / barrel
// IMPORTANT coordinate convention: BreakableObj.y is the BOTTOM of the sprite
// (ground contact point). The sprite is drawn UPWARD from y - h to y.
// This differs from Entity where y is the sprite top.
//
// A crate takes CFG.objBreakHits blows to destroy, not one. It starts intact,
// switches to the cracked 'damaged' sprite once the first blow lands, and only
// bursts on the final hit. Every blow jolts the crate; the last one throws a
// shower of splinters through BreakFX.

class BreakableObj {
    constructor(wx, wy) {
        this.x = wx; this.y = wy;
        this.broken = false;
        this.w = 48; this.h = 56;
        // hits counts blows landed so far. lastSeq is the id of the player
        // attack that last connected: the player's hit test runs every frame of
        // an attack animation, so without it one swing would spend the crate's
        // whole health in a handful of frames.
        this.hits    = 0;
        this.lastSeq = -1;
        // shakeT drives the recoil jolt in draw(). shakeDir is the direction the
        // blow came from, so the crate rocks away from the player.
        this.shakeT   = 0;
        this.shakeDir = 1;
        // Splinter colors for BreakFX. Null is the crate's own palette; a
        // breakable cut from level art passes the colors it is painted in.
        this.breakColors = null;
    }

    // inHitDepth - whether a player whose feet are at feetY is level with this
    // object on the depth axis, closely enough (tol) for a blow to land. A
    // crate stands on one line of depth, its bottom edge. Breakables that span
    // depth, such as a gate arm lying across the street, override this.
    inHitDepth(feetY, tol) {
        return Math.abs(feetY - this.y) < tol;
    }

    // Centre of the crate in world space — where impact effects are anchored.
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y - this.h / 2; }

    // The sprite to draw: intact until the first blow, cracked while it still
    // has hits left in it, burst once it is gone.
    get img() {
        if (this.broken)  return OBJECTS.broken;
        if (this.hits > 0) return OBJECTS.damaged;
        return OBJECTS.intact;
    }

    update(dt) {
        if (this.shakeT > 0) this.shakeT -= dt;
    }

    // hit — land one blow on the crate. 'seq' is the attack id from the player
    // (Player.atkSeq); passing the same seq twice is ignored so a single swing
    // counts once no matter how many frames it overlaps the crate for.
    // Returns true when the blow actually registered.
    hit(effects, pickups, seq, fromX) {
        if (this.broken) return false;
        if (seq !== undefined && seq === this.lastSeq) return false;
        this.lastSeq = seq;

        this.hits++;
        this.shakeT   = CFG.objHitShakeTime;
        this.shakeDir = (fromX !== undefined && fromX > this.cx) ? -1 : 1;

        const needed = Math.max(1, Math.round(CFG.objBreakHits));
        if (this.hits >= needed) {
            this.smash(effects, pickups);
        } else {
            // A blow that only damages the crate gets the light impact puff —
            // the heavy one is saved for the break so the two read differently.
            effects.push(new HitFX(this.cx, this.cy, 'small'));
        }
        return true;
    }

    smash(effects, pickups) {
        if (this.broken) return;
        this.broken = true;
        this.hits   = Math.max(this.hits, Math.round(CFG.objBreakHits));
        effects.push(new HitFX(this.cx, this.cy - 4, 'hard'));
        effects.push(new BreakFX(this.cx, this.cy, undefined, this.breakColors));
        // Drop chance controlled by CFG.objBreakDropChance (default 65%).
        if (Math.random() < CFG.objBreakDropChance)
            pickups.push(new Pickup(this.x + 8 + Math.random() * 28, this.y - 10, 'health'));
    }

    // _shakeOffset - this frame's sideways jolt in px. The jolt is a decaying
    // wobble: it starts at objHitShakeDist px and rings down to nothing over
    // objHitShakeTime, so a crate that survives a blow visibly takes it.
    _shakeOffset() {
        if (this.shakeT <= 0 || CFG.objHitShakeTime <= 0) return 0;
        const a = this.shakeT / CFG.objHitShakeTime;
        return Math.sin(a * Math.PI * 3) * CFG.objHitShakeDist * a * this.shakeDir;
    }

    draw() {
        const sx = this.x - cam.x + this._shakeOffset();
        ctx.drawImage(this.img, sx, this.y - this.h, this.w, this.h);
    }
}

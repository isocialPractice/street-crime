// js/entities/entity.js — Entity base class
// Shared properties and methods for Player and Enemy. Never instantiate directly.
// This game uses a 2.5D coordinate system:
//   X = horizontal world axis (scrolls with camera)
//   Y = DEPTH axis (GROUND_MIN = back, GROUND_MAX = front)
//   Z = JUMP axis (z=0 means on the ground; positive z lifts sprite upward)

class Entity {
    constructor(x, y, w, h) {
        this.x = x;  this.y = y;
        this.z  = 0; this.vz = 0;   // z = jump height; vz = vertical velocity
        this.vx = 0; this.vy = 0;
        this.w = w;  this.h = h;
        this.hp = 100; this.maxHp = 100;
        // facing is 1 (right) or -1 (left) — used to flip the sprite and direct
        // attack hitboxes and knockback in the correct direction.
        this.facing = 1;
        this.state = 'idle';
        this.stTimer = 0;  // state countdown
        this.animT  = 0;   // time inside current state (for animation)
        this.dead   = false;
    }

    // screenX converts world X to screen X by subtracting the camera offset.
    // drawY lifts the sprite upward by z when the entity is airborne.
    get screenX() { return this.x - cam.x; }
    get drawY()   { return this.y - this.z; }
    get grounded(){ return this.z <= 0 && this.vz <= 0; }

    // stepState advances the animation timer and fires _onStateEnd when a timed
    // state expires. All state durations are in seconds; stTimer counts down using
    // delta time (dt) so timing is frame-rate independent.
    stepState(dt) {
        this.animT += dt;
        if (this.stTimer > 0) {
            this.stTimer -= dt;
            if (this.stTimer <= 0) { this.stTimer = 0; this._onStateEnd(); }
        }
    }

    // setState resets animT so animation always starts from the beginning of the
    // new state. dur=0 means no timer (persists until code changes it explicitly).
    setState(s, dur = 0) {
        this.state = s; this.stTimer = dur; this.animT = 0;
    }

    _onStateEnd() { this.setState('idle'); }

    // applyGravity uses Euler integration: velocity changes by acceleration*dt
    // each frame, and position changes by velocity*dt.
    applyGravity(dt) {
        if (!this.grounded || this.vz > 0) {
            this.vz -= CFG.gravity * dt;
            this.z  += this.vz  * dt;
            if (this.z <= 0) { this.z = 0; this.vz = 0; this._onLand(); }
        }
    }

    _onLand() {}

    // moveXY applies planar (X/Y) velocity and clamps Y to the walkable zone.
    moveXY(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.y  = Math.max(CFG.groundMin, Math.min(CFG.groundMax, this.y));
    }

    // drawShadow — always drawn at y + h (feet/ground contact), alpha fades
    // with height so the shadow becomes fainter when airborne.
    drawShadow() {
        const a = Math.max(0.05, 0.35 - this.z * 0.0005);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(this.screenX + this.w / 2, this.y + this.h - 6,
                    this.w * 0.32, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

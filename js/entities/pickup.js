// js/entities/pickup.js — Health pickup dropped by broken crates

class Pickup {
    constructor(wx, wy, type) {
        this.x = wx; this.y = wy; this.type = type;
        this.taken = false; this.bt = 0;
    }

    update(dt) { this.bt += dt; }

    draw() {
        if (this.taken) return;
        // Math.sin(bt * 4) * 4 produces a smooth up-down bob oscillating
        // 4 pixels above/below the base position, cycling ~once per 1.6 seconds.
        const bob = Math.sin(this.bt * 4) * 4;
        const sx  = this.x - cam.x;
        ctx.drawImage(OBJECTS.health, sx - 14, this.y - 32 + bob, 28, 28);
    }
}

// js/core/camera.js — Camera position and screen-shake
// cam.x is the world X offset — every entity subtracts cam.x from its world X
// to get its screen X position. cam.shakeX/Y are random per-frame offsets applied
// via ctx.translate() in draw(), so the whole scene vibrates together.

const cam = { x: 0, shakeX: 0, shakeY: 0, power: 0 };

// screenShake — Math.max keeps the strongest recent shake so simultaneous hits
// don't cancel each other. Shake decays 25 units per second in updateCamera().
function screenShake(power) { cam.power = Math.max(cam.power, power); }

function updateCamera(dt) {
    if (cam.power > 0) {
        // (Math.random() - 0.5) * power * 2 gives a jitter in [-power, +power].
        // Each frame gets an independent random offset for the "camera shake" feel.
        cam.shakeX = (Math.random() - .5) * cam.power * 2;
        cam.shakeY = (Math.random() - .5) * cam.power * 2;
        cam.power = Math.max(0, cam.power - 25 * dt);
    } else { cam.shakeX = cam.shakeY = 0; }
}

// js/rendering/background.js — Infinite parallax background rendering
// The background image is 1600px wide (2x the 800px canvas). drawBg() tiles
// two copies side-by-side and shifts them using parallax, creating an infinite
// scrolling effect without needing to preload multiple images.

function drawBg(bgIdx) {
    const bgImg    = BACKGROUNDS[Math.min(bgIdx, BACKGROUNDS.length - 1)];
    const bgW      = 1600;
    const parallax = cam.x * 0.45;
    const offset   = parallax % bgW;
    ctx.drawImage(bgImg,     -offset,         0, bgW, H);
    ctx.drawImage(bgImg, bgW - offset,        0, bgW, H);

    // A linear gradient overlay darkens the ground zone toward the front of the
    // scene, reinforcing the perspective depth cue.
    const grd = ctx.createLinearGradient(0, CFG.groundMin, 0, CFG.groundMax + 30);
    grd.addColorStop(0,   'rgba(0,0,0,0)');
    grd.addColorStop(1,   'rgba(0,0,0,0.25)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, CFG.groundMin, W, CFG.groundMax - CFG.groundMin + 30);
}

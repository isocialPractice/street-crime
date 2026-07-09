// js/rendering/background.js — Infinite parallax background rendering
// The background image is 1600px wide (2x the 800px canvas). drawBg() tiles
// two copies side-by-side and shifts them using parallax, creating an infinite
// scrolling effect without needing to preload multiple images.
//
// On top of the static SVG tile, drawBgAmbience() animates small details that
// match props baked into the SVG (neon signs, warning lights, flaming barrels).
// Positions below are tile-local coordinates copied from js/sprites/backgrounds.js,
// so the animated overlays land exactly on their static counterparts.

const BG_TILE_W = 1600;

function drawBg(bgIdx) {
    const bgImg    = BACKGROUNDS[Math.min(bgIdx, BACKGROUNDS.length - 1)];
    const bgW      = BG_TILE_W;
    const parallax = cam.x * 0.45;
    const offset   = parallax % bgW;
    ctx.drawImage(bgImg,     -offset,         0, bgW, H);
    ctx.drawImage(bgImg, bgW - offset,        0, bgW, H);

    if (CFG.bgAmbience) drawBgAmbience(bgIdx, offset);

    // A linear gradient overlay darkens the ground zone toward the front of the
    // scene, reinforcing the perspective depth cue.
    const grd = ctx.createLinearGradient(0, CFG.groundMin, 0, CFG.groundMax + 30);
    grd.addColorStop(0,   'rgba(0,0,0,0)');
    grd.addColorStop(1,   'rgba(0,0,0,0.25)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, CFG.groundMin, W, CFG.groundMax - CFG.groundMin + 30);
}

// drawBgAmbience — animated detail pass, drawn once per visible tile.
// Uses wall-clock time as the animation driver so ambience keeps breathing
// on the pause screen; it never touches game state.
function drawBgAmbience(bgIdx, offset) {
    const t = performance.now() / 1000;
    for (const tileX of [-offset, BG_TILE_W - offset]) {
        // Skip a tile that is entirely off screen.
        if (tileX > W || tileX + BG_TILE_W < 0) continue;
        if      (bgIdx === 0) _ambStreets(t, tileX);
        else if (bgIdx === 1) _ambDocks(t, tileX);
        else                  _ambHideout(t, tileX);
    }
}

// ── Stage 1: The Streets — neon flicker and streetlight pulse ─────────────────
function _ambStreets(t, tileX) {
    ctx.save();

    // Neon signs. Two independent flicker signals: a fast shimmer plus an
    // occasional hard dropout, like a failing tube.
    const NEONS = [
        { x:232, y:130, w:96, h:18, color:'232,48,80',   phase:0   },
        { x:880, y:98,  w:76, h:16, color:'32,192,224',  phase:2.7 },
    ];
    for (const n of NEONS) {
        const shimmer = 0.5 + 0.5 * Math.sin(t * 11 + n.phase) * Math.sin(t * 4.3 + n.phase * 2);
        const dropout = Math.sin(t * 1.7 + n.phase * 3) > -0.93 ? 1 : 0.1;
        const a = (0.08 + 0.22 * shimmer) * dropout;
        ctx.fillStyle = `rgba(${n.color},${a.toFixed(3)})`;
        ctx.fillRect(tileX + n.x - 6, n.y - 6, n.w + 12, n.h + 12);
    }

    // Streetlight glow — slow, subtle brightness pulse per lamp head.
    const LAMPS = [ { x:252, y:310 }, { x:852, y:302 }, { x:1352, y:306 } ];
    LAMPS.forEach((l, i) => {
        const a = 0.10 + 0.06 * Math.sin(t * 1.3 + i * 2.1);
        ctx.fillStyle = `rgba(255,229,144,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(tileX + l.x, l.y, 34, 13, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

// ── Stage 2: The Docks — blinking warning lights and drifting water shimmer ───
function _ambDocks(t, tileX) {
    ctx.save();

    // Rooftop warning lights blink on a slow square wave, offset per light.
    const LIGHTS = [ { x:220, y:180 }, { x:540, y:152 }, { x:1070, y:172 } ];
    LIGHTS.forEach((l, i) => {
        const on = Math.sin(t * 3.6 + i * 2.2) > 0;
        const a  = on ? 0.85 : 0.15;
        ctx.fillStyle = `rgba(255,90,10,${a})`;
        ctx.beginPath();
        ctx.arc(tileX + l.x, l.y, on ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        if (on) {
            ctx.fillStyle = 'rgba(255,90,10,0.18)';
            ctx.beginPath();
            ctx.arc(tileX + l.x, l.y, 13, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Water shimmer — short bright segments drifting slowly along the
    // shimmer lines baked into the SVG (y = 460 / 490 / 520).
    ctx.strokeStyle = 'rgba(90,170,220,0.28)';
    ctx.lineWidth = 1;
    const ROWS = [ { y:460, speed:16 }, { y:490, speed:-11 }, { y:520, speed:8 } ];
    for (const row of ROWS) {
        for (let i = 0; i < 10; i++) {
            const sx = tileX + (((i * 173 + row.y * 7) + t * row.speed) % BG_TILE_W + BG_TILE_W) % BG_TILE_W;
            const len = 26 + (i * 29) % 22;
            ctx.beginPath();
            ctx.moveTo(sx, row.y);
            ctx.lineTo(sx + len, row.y);
            ctx.stroke();
        }
    }

    // Moon reflection sway on the water.
    const ra = 0.10 + 0.05 * Math.sin(t * 0.9);
    ctx.fillStyle = `rgba(120,180,220,${ra.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(tileX + 1350 + Math.sin(t * 0.7) * 4, 450, 14, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ── Stage 3: The Hideout — flame flicker and rising embers ────────────────────
function _ambHideout(t, tileX) {
    ctx.save();

    const BARRELS = [ { x:155 }, { x:755 }, { x:1355 } ];
    BARRELS.forEach((b, i) => {
        const ph = i * 2.4;

        // Flame body — two stacked ellipses whose height and sway jitter.
        const sway = Math.sin(t * 7.3 + ph) * 2.5;
        const lick = 0.75 + 0.25 * Math.sin(t * 9.1 + ph) * Math.sin(t * 5.7 + ph * 2);
        ctx.fillStyle = `rgba(224,64,0,${(0.35 * lick).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(tileX + b.x + sway * 0.6, 358 - 6 * lick, 12, 26 * lick + 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,150,20,${(0.35 * lick).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(tileX + b.x + sway, 350 - 8 * lick, 7, 16 * lick + 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ground glow cast by the fire.
        ctx.fillStyle = `rgba(224,80,0,${(0.06 + 0.04 * lick).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(tileX + b.x, 388, 46, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rising embers — a few looping particles per barrel. Deterministic
        // per-index offsets keep them stable without storing particle state.
        for (let k = 0; k < 4; k++) {
            const cycle = ((t * 26 + k * 31 + i * 17) % 95);
            const ex = tileX + b.x + Math.sin(t * 2.2 + k * 1.9 + ph) * (5 + k * 3);
            const ey = 368 - cycle;
            const ea = Math.max(0, 0.55 * (1 - cycle / 95));
            ctx.fillStyle = `rgba(255,${140 + k * 20},40,${ea.toFixed(3)})`;
            ctx.fillRect(ex, ey, 2, 2);
        }
    });

    ctx.restore();
}

function drawStageBackground(stageData) {
    const scene = stageData?.scene;
    if (scene?.img) {
        ctx.drawImage(scene.img, -cam.x * (scene.parallax ?? 1), 0, scene.worldWidth, scene.worldHeight);
        return;
    }
    drawBg(stageData?.bgIdx ?? 0);
}

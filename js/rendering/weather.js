// js/rendering/weather.js - Local weather render layer
//
// This layer is additive. It never edits the stage SVGs in
// js/sprites/backgrounds.js, so the whole effect switches off with CFG.weather.
//
// Two passes bracket the entity depth sort in draw():
//   drawWeatherSky(stageData)  - moon, storm clouds, sky tone. Behind characters.
//   drawWeatherFront()         - rain, splashes, lightning, heat haze. In front.
//
// Like drawBgAmbience(), both passes are driven by performance.now() instead of
// the frame delta, so the weather keeps moving on the pause screen and never
// touches game state.
//
// Current render: night / hot / stormy. See local-weather-style/STYLE.md for
// the full mapping from server directives to the CFG keys used below.

const WX_TILE_W = 1600;   // matches BG_TILE_W in background.js

// Sky body slot per background index, in tile-local coordinates copied from
// js/sprites/backgrounds.js. Stages 0 and 1 have a moon baked into the scene,
// so the sprite is drawn on that exact spot rather than beside it. Stage 2 has
// no baked moon, so the slot is a free choice above its skyline.
const WEATHER_SKY_BODY = [
    { x: 1460, y:  62, r: 26 },   // 0: The Streets
    { x: 1350, y:  55, r: 22 },   // 1: The Docks
    { x: 1180, y:  58, r: 24 },   // 2: The Hideout
];
const WEATHER_SKY_BODY_DEFAULT = { x: 1200, y: 62, r: 24 };

// Cloud layers. Back clouds are darker, slower and larger, which reads as
// depth without needing a second parallax system.
const WX_CLOUD_LAYERS = [
    { scale: 0.62, speed:  9, y:  36, tint: '#0a1018', alpha: 0.72, jitter: 38 },
    { scale: 0.44, speed: 15, y:  96, tint: '#131c28', alpha: 0.58, jitter: 28 },
];

// Pre-rendered sprite caches. Recolouring a sprite every frame is wasteful, so
// each variant is flattened once into an offscreen canvas the first time it is
// needed, after its source SVG has decoded.
const _wxCache = {};

// _wxTinted - flatten an SVG sprite into a solid-colour silhouette.
// 'source-in' keeps the sprite's alpha shape and replaces every pixel colour,
// which turns the white cloud art into a storm cloud without a second asset.
function _wxTinted(key, img, w, h, color) {
    const cached = _wxCache[key];
    if (cached) return cached;
    if (!img || !img.complete || !img.naturalWidth) return null;

    const off = document.createElement('canvas');
    off.width  = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, off.width, off.height);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = color;
    octx.fillRect(0, 0, off.width, off.height);

    _wxCache[key] = off;
    return off;
}

// _wxPlain - flatten an SVG sprite at its draw size with its own colours kept.
function _wxPlain(key, img, w, h) {
    const cached = _wxCache[key];
    if (cached) return cached;
    if (!img || !img.complete || !img.naturalWidth) return null;

    const off = document.createElement('canvas');
    off.width  = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    off.getContext('2d').drawImage(img, 0, 0, off.width, off.height);

    _wxCache[key] = off;
    return off;
}

// _wxRand - deterministic pseudo random in [0,1) from an integer index.
// Particles are positioned from their index rather than stored state, so the
// field survives a pause, a stage change, or a count change without bookkeeping.
function _wxRand(i) {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

// _wxStrike - lightning envelope for the current time.
// Returns 0 when the sky is quiet, otherwise the flash brightness in [0,1].
// A strike is two quick pulses, the second dimmer, like a real return stroke.
function _wxStrike(t) {
    const period = 7.3;
    const cycle  = t % period;
    // Vary the gap between strikes so the rhythm does not read as a metronome.
    const jitter = _wxRand(Math.floor(t / period)) * 3.4;
    const local  = cycle - jitter;
    if (local < 0)     return 0;
    if (local < 0.07)  return 1 - local / 0.07;
    if (local < 0.16)  return 0;
    if (local < 0.26)  return 0.55 * (1 - (local - 0.16) / 0.10);
    return 0;
}

// ── Sky pass ─────────────────────────────────────────────────────────────────
function drawWeatherSky(stageData) {
    if (!CFG.weather) return;
    const t     = performance.now() / 1000;
    const bgIdx = stageData?.bgIdx ?? 0;

    _wxSkyTone();
    if (CFG.weatherNight) _wxMoon(bgIdx, stageData);
    if (CFG.weatherClouds && CFG.weatherPrecip !== 'sunny') _wxClouds(t);
}

// Daylight wash. Every authored stage sky is a night sky, so a day render
// lifts it toward blue rather than swapping the artwork.
function _wxSkyTone() {
    if (CFG.weatherSkyLift <= 0) return;
    const grd = ctx.createLinearGradient(0, 0, 0, CFG.groundMin);
    grd.addColorStop(0, `rgba(120,180,235,${CFG.weatherSkyLift.toFixed(3)})`);
    grd.addColorStop(1, `rgba(190,215,240,${(CFG.weatherSkyLift * 0.45).toFixed(3)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, CFG.groundMin);
}

// The moon rides the background tile at the same 0.45 parallax as drawBg, so on
// stages 0 and 1 it lands on the disc already painted into the scene SVG.
// A custom SVG scene stage has no tile grid, so it falls back to a fixed slot.
function _wxMoon(bgIdx, stageData) {
    const img = WEATHER_SPRITES.moon;
    const slot = WEATHER_SKY_BODY[bgIdx] || WEATHER_SKY_BODY_DEFAULT;
    const size = slot.r * 2.15;
    const disc = _wxPlain(`moon${bgIdx}`, img, size, size);
    if (!disc) return;

    const isScene = !!stageData?.scene?.img;
    const offset  = isScene ? 0 : (cam.x * 0.45) % WX_TILE_W;
    const tiles   = isScene ? [0] : [-offset, WX_TILE_W - offset];

    for (const tileX of tiles) {
        const cx = tileX + slot.x;
        const cy = slot.y;
        if (cx + size < 0 || cx - size > W) continue;

        // Warm halo. On a hot render the moon glows amber through the haze
        // instead of the cold silver it would have on a temperate night.
        const halo = ctx.createRadialGradient(cx, cy, slot.r * 0.4, cx, cy, slot.r * 3.6);
        const hot  = CFG.weatherTone === 'hot';
        halo.addColorStop(0, hot ? 'rgba(255,190,120,0.30)' : 'rgba(200,220,255,0.26)');
        halo.addColorStop(1, hot ? 'rgba(255,150,60,0)'     : 'rgba(180,210,255,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, slot.r * 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.92;
        ctx.drawImage(disc, cx - size / 2, cy - size / 2);
        ctx.globalAlpha = 1;
    }
}

// Drifting cloud bank. Clouds move on wall-clock time and on camera position,
// so they slide when the player runs and keep drifting when the player stands.
function _wxClouds(t) {
    const img   = WEATHER_SPRITES.cloud;
    const heavy = CFG.weatherPrecip === 'stormy';
    const count = Math.max(1, Math.round(CFG.weatherCloudCount * (heavy ? 1 : 0.55)));

    WX_CLOUD_LAYERS.forEach((layer, li) => {
        const w = 281.76 * layer.scale * (heavy ? 1.25 : 1);
        const h = 178.25 * layer.scale * (heavy ? 1.25 : 1);
        const tint = heavy ? layer.tint : '#3a4655';
        const sprite = _wxTinted(`cloud${li}${heavy ? 'h' : 'l'}`, img, w, h, tint);
        if (!sprite) return;

        // The drift band is wider than the canvas so clouds enter and leave
        // instead of popping at the edges.
        const band = W + w * 2;
        ctx.globalAlpha = layer.alpha * (heavy ? 1 : 0.75);
        for (let i = 0; i < count; i++) {
            const seed = _wxRand(i + li * 97);
            const drift = t * layer.speed + cam.x * 0.22 * (li + 1);
            const x = ((seed * band - drift) % band + band) % band - w;
            const y = layer.y + _wxRand(i + li * 53 + 11) * layer.jitter
                    + Math.sin(t * 0.35 + i) * 3;
            ctx.drawImage(sprite, x, y);
        }
        ctx.globalAlpha = 1;
    });
}

// ── Front pass ───────────────────────────────────────────────────────────────
function drawWeatherFront() {
    if (!CFG.weather) return;
    const t = performance.now() / 1000;

    if (CFG.weatherPrecip === 'stormy') {
        _wxRain(t);
        _wxSplashes(t);
    }
    _wxTemperatureGrade(t);
    if (CFG.weatherLightning && CFG.weatherPrecip === 'stormy') _wxLightning(t);
}

// Wind-driven rain. Every drop shares the same slant, so the canvas is rotated
// once and the drops are placed in that rotated frame. Screen point (x,y) maps
// to rotated-frame ( x*cos + y*sin , -x*sin + y*cos ), which is the inverse of
// the rotation just applied.
function _wxRain(t) {
    const wind  = CFG.weatherWind;
    const speed = CFG.weatherRainSpeed;
    const dropW = 3.2;
    const dropH = 16;
    const drop  = _wxPlain('rain', WEATHER_SPRITES.rain, dropW, dropH);
    if (!drop) return;

    const angle = -Math.atan(wind);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const span = H + 60;
    const count = CFG.weatherRainCount;

    ctx.save();
    ctx.rotate(angle);
    ctx.globalAlpha = 0.62;
    for (let i = 0; i < count; i++) {
        // Near drops fall faster and are drawn slightly longer, which gives the
        // sheet some depth without a second particle system.
        const near  = 0.65 + _wxRand(i + 401) * 0.7;
        const fall  = (_wxRand(i) * span + t * speed * near) % span - 30;
        const drift = t * speed * wind * near + cam.x;
        const x = ((_wxRand(i + 131) * (W + 240) - drift) % (W + 240) + (W + 240)) % (W + 240) - 120;
        const y = fall;
        ctx.drawImage(drop,
                      x * cos + y * sin,
                      -x * sin + y * cos,
                      dropW * near, dropH * near * 1.3);
    }
    ctx.restore();

    // Wet sheen across the road. Short bright horizontal streaks that fade in
    // and out along the walkable zone, echoing the dock water shimmer.
    ctx.save();
    ctx.strokeStyle = 'rgba(150,190,225,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
        const sy = CFG.groundMin + 12 + _wxRand(i + 71) * (CFG.groundMax - CFG.groundMin + 60);
        const sx = ((_wxRand(i + 17) * W - cam.x * 0.9) % W + W) % W;
        const len = 22 + _wxRand(i + 29) * 40;
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2.1 + i);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + len, sy);
        ctx.stroke();
    }
    ctx.restore();
}

// Impact splashes along the ground zone. Each splash is a short expanding arc
// on its own loop, so the ground reads as being hit rather than merely wet.
function _wxSplashes(t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,220,245,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
        const cycle = (t * 1.9 + _wxRand(i + 211)) % 1;
        const life  = 1 - cycle;
        const sx = ((_wxRand(i + 307) * W - cam.x * 0.9) % W + W) % W;
        const sy = CFG.groundMin + 8 + _wxRand(i + 409) * (CFG.groundMax - CFG.groundMin + 70);
        ctx.globalAlpha = life * 0.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2 + cycle * 7, (2 + cycle * 7) * 0.34, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

// Temperature colour grade plus its ground-level air effect. On a hot render
// the whole frame warms toward amber and the air above the road shimmers.
function _wxTemperatureGrade(t) {
    if (CFG.weatherTone === 'medium' || CFG.weatherToneAlpha <= 0) return;
    const hot = CFG.weatherTone === 'hot';

    ctx.save();
    ctx.fillStyle = hot
        ? `rgba(255,110,30,${CFG.weatherToneAlpha.toFixed(3)})`
        : `rgba(120,180,255,${CFG.weatherToneAlpha.toFixed(3)})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Haze band sitting on the horizon line. Heat rises, so the hot band is
    // anchored at the top of the walkable zone and fades upward; cold frost
    // mist hugs the floor instead.
    const top = hot ? CFG.groundMin - 46 : CFG.groundMin + 20;
    const grd = ctx.createLinearGradient(0, top, 0, top + 90);
    if (hot) {
        grd.addColorStop(0, 'rgba(255,150,60,0)');
        grd.addColorStop(1, `rgba(255,140,50,${(0.16 + 0.05 * Math.sin(t * 1.6)).toFixed(3)})`);
    } else {
        grd.addColorStop(0, `rgba(200,225,255,${(0.14 + 0.04 * Math.sin(t * 1.1)).toFixed(3)})`);
        grd.addColorStop(1, 'rgba(200,225,255,0)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, top, W, 90);
    ctx.restore();
}

// Lightning. The flash washes the frame, and a bolt is only drawn on the
// leading pulse so the second, dimmer pulse reads as the sky still glowing.
function _wxLightning(t) {
    const flash = _wxStrike(t);
    if (flash <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(214,228,255,${(flash * 0.38).toFixed(3)})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    if (flash > 0.45) {
        // Bolt path is seeded from the strike index, so one strike keeps one
        // shape for its whole duration instead of flickering to a new one.
        const strike = Math.floor(t / 7.3);
        let x = _wxRand(strike + 3) * W;
        let y = 0;
        ctx.strokeStyle = `rgba(235,244,255,${(flash * 0.9).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let seg = 1; seg <= 6; seg++) {
            x += (_wxRand(strike * 13 + seg) - 0.5) * 74;
            y += CFG.groundMin / 6;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

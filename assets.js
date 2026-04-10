// assets.js — all game image assets
// Note 1: This file is responsible for loading every visual asset the game uses.
// It runs once at page load; all returned Image objects are used by game.js for drawing.
// To add a new sprite, create the SVG file in assets/ and add an entry to the relevant object below.

// _decodePromises collects img.decode() Promises for every sprite created by
// loadSvgFile. ASSETS_READY (defined at the bottom of this file) resolves once
// every sprite has finished decoding. The boot sequence in game.js awaits it
// so the game loop never starts before ctx.drawImage() has valid pixel data.
const _decodePromises = [];

// loadSvgFile — fetches an SVG file synchronously (XHR), converts it to a Blob
// URL (same technique as loadSvgImg used for backgrounds), and registers the
// resulting image for decode tracking. This is the only reliable way to draw
// SVG files on a canvas: direct img.src paths produce blank draws on most browsers.
function loadSvgFile(path) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false); // synchronous — only runs once at startup
        xhr.send();
        const img = loadSvgImg(xhr.responseText ||
            '<svg xmlns="http://www.w3.org/2000/svg"/>');
        // img.decode() resolves when the browser has fully decoded the image
        // and it is safe to call ctx.drawImage(). Without this wait the first
        // frame draws nothing and the sprite flickers in on the second frame.
        _decodePromises.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
        return img;
    } catch(e) {
        console.warn('[assets] Could not load', path, e);
        return new Image();
    }
}

// Note 3: loadSvgImg — loads an SVG string that was generated in JavaScript (not a file on disk).
// A Blob is a raw binary object; here we wrap the SVG text so the browser treats it as an image file.
// URL.createObjectURL() returns a temporary local URL (e.g. blob:null/abc123) the Image can load from.
// This avoids writing the background art to disk — the entire scene is built and loaded at runtime.
function loadSvgImg(svgStr) {
    const img = new Image();
    // Note 4: Blob type 'image/svg+xml' tells the browser how to interpret the bytes.
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    // Note 5: createObjectURL gives us a URL we can assign to img.src just like a file path.
    img.src = URL.createObjectURL(blob);
    return img;
}

// ── Player animations ────────────────────────────────────────────────────────
// Note 6: PLAYER is a plain object used as a named sprite map.
// Each key is a logical animation state. game.js reads the matching key each frame
// and draws that image. To swap an animation, simply point the key to a different file.
// To add a new player state (e.g. 'block'), add the key here and handle it in Player.getImg().
const PLAYER = {
    idle1:       loadSvgFile('assets/Player_Ideal_1.svg'),
    idle2:       loadSvgFile('assets/Player_Ideal_2.svg'),
    idle3:       loadSvgFile('assets/Player_Ideal_3.svg'),
    idle4:       loadSvgFile('assets/Player_Ideal_4.svg'),
    walk0:       loadSvgFile('assets/Player_Walk_0.svg'),
    walk1:       loadSvgFile('assets/Player_Walk_1.svg'),
    walk2:       loadSvgFile('assets/Player_Walk_2.svg'),
    walk3:       loadSvgFile('assets/Player_Walk_3.svg'),
    walk4:       loadSvgFile('assets/Player_Walk_4.svg'),
    walk5:       loadSvgFile('assets/Player_Walk_5.svg'),
    walk6:       loadSvgFile('assets/Player_Walk_6.svg'),
    walk7:       loadSvgFile('assets/Player_Walk_7.svg'),
    run:         loadSvgFile('assets/Player_Run.svg'),
    jump:        loadSvgFile('assets/Player_Jump.svg'),
    jumpKick:    loadSvgFile('assets/Player_JumpKick.svg'),
    kick1:       loadSvgFile('assets/Player_Kick_1.svg'),
    kick2:       loadSvgFile('assets/Player_Kick_2.svg'),
    punch1:      loadSvgFile('assets/Player_Punch_1.svg'),
    punch2:      loadSvgFile('assets/Player_Punch_2.svg'),
    knockDown:   loadSvgFile('assets/Player_Damage.svg'),
    upperCut:    loadSvgFile('assets/Player_UpperCut.svg'),
    runningKick: loadSvgFile('assets/Player_RunningKick.svg'),
};

// ── Enemy character sprites (per-character state sets) ────────────────────────
// Note 7: ENEMY_CHARS keys must exactly match the 'img' field in ENEMY_DEFS (in game.js).
// Each entry: { idle, walk?, walk2?, punch?, kick?, punch2?, attack?, damage?, damage2?, preDefeat?, defeat? }
// The '?' means the field is optional. Enemy.getImg() falls back to 'idle' when a state sprite
// is absent, so you can ship a minimal { idle } entry and the enemy will still work visually.
// Walk animation: if walk2 exists the cycle is walk→walk2→walk (3-frame); otherwise idle↔walk (2-frame).
// Attack sprite resolution order: punch → kick → attack (generic fallback).
// 'punch2' holds a second punch frame shown after the first is held.
// 'damage'/'damage2' are shown when the enemy is hurt; 'preDefeat' shows during knockdown/knockedUp.
// Characters without any attack sprite use a rotation effect in draw() instead.
const ENEMY_CHARS = {
    // ── Full animation sets ───────────────────────────────────────────────────
    CrimeGuy:           { idle:    loadSvgFile('assets/CrimeGuy.svg'),
                          walk:    loadSvgFile('assets/CrimeGuy_walk_1.svg'),
                          walk2:   loadSvgFile('assets/CrimeGuy_walk_2.svg'),
                          punch:   loadSvgFile('assets/CrimeGuy_punch.svg'),
                          defeat:  loadSvgFile('assets/CrimeGuy_defeat.svg') },
    BadGirl:            { idle:    loadSvgFile('assets/BadGirl.svg'),
                          walk:    loadSvgFile('assets/BadGirl_walk_1.svg'),
                          walk2:   loadSvgFile('assets/BadGirl_walk_2.svg'),
                          kick:    loadSvgFile('assets/BadGirl_kick.svg'),
                          defeat:  loadSvgFile('assets/BadGilr_defeat.svg') }, // filename typo preserved
    SassyGirl:          { idle:    loadSvgFile('assets/SassyGirl.svg'),
                          walk:    loadSvgFile('assets/SassyGirl_walk_1.svg'),
                          walk2:   loadSvgFile('assets/SassyGirl_walk_2.svg'),
                          punch:   loadSvgFile('assets/SassyGirl_punch_1.svg'),
                          punch2:  loadSvgFile('assets/SassyGirl_punch_2.svg'),
                          defeat:  loadSvgFile('assets/SassyGirl_defeat.svg') },
    JammingJabber:      { idle:    loadSvgFile('assets/JammingJabber.svg'),
                          walk:    loadSvgFile('assets/JammingJabber_walk_1.svg'),
                          walk2:   loadSvgFile('assets/JammingJabber_walk_2.svg'),
                          punch:   loadSvgFile('assets/JammingJabber_punch.svg'),
                          defeat:  loadSvgFile('assets/JammingJabber_defeat.svg') },
    JumpingJunkie:      { idle:      loadSvgFile('assets/JumpingJunkie.svg'),
                          walk:      loadSvgFile('assets/JumpingJunkie_walk_1.svg'),
                          walk2:     loadSvgFile('assets/JumpingJunkie_walk_2.svg'),
                          attack:    loadSvgFile('assets/JumpingJunkie_attack.svg'),
                          damage:    loadSvgFile('assets/JumpingJunkie_damage_1.svg'),
                          damage2:   loadSvgFile('assets/JumpingJunkie_damage_2.svg'),
                          preDefeat: loadSvgFile('assets/JumpingJunkie_preDefeat.svg'),
                          defeat:    loadSvgFile('assets/JumpingJunkie_defeat.svg') },
    KingBruteBreaker:   { idle:    loadSvgFile('assets/KingBruteBreaker.svg'),
                          walk:    loadSvgFile('assets/KingBruteBreaker_walk.svg'),
                          attack:  loadSvgFile('assets/KingBruteBreaker_attack.svg'),
                          defeat:  loadSvgFile('assets/KingBruteBreaker_defeat.svg') },
    // ── Characters with idle + defeat only (no animation variants exist yet) ────
    BadOne:             { idle:    loadSvgFile('assets/BadOne.svg'),
                          defeat:  loadSvgFile('assets/BadOne_defeat.svg') },
    TightRomper:        { idle:    loadSvgFile('assets/TightRomper.svg'),
                          defeat:  loadSvgFile('assets/TightRomper_defeat.svg') },
    GreenJetter:        { idle:    loadSvgFile('assets/GreenJetter.svg'),
                          defeat:  loadSvgFile('assets/GreenJetter_defeat.svg') },
    RoadFighter:        { idle:    loadSvgFile('assets/RoadFighter.svg'),
                          defeat:  loadSvgFile('assets/RoadFighter_defeat.svg') },
    Stomper:            { idle:    loadSvgFile('assets/Stomper.svg'),
                          defeat:  loadSvgFile('assets/Stomper_defeat.svg') },
    GreenStomper:       { idle:    loadSvgFile('assets/GreenStomper.svg'),
                          defeat:  loadSvgFile('assets/GreenStomper_defeat.svg') },
    SoldierCrime:       { idle:    loadSvgFile('assets/SoldierCrime.svg'),
                          defeat:  loadSvgFile('assets/SoldierCrime_defeat.svg') },
    RedRowRonda:        { idle:    loadSvgFile('assets/RedRowRonda.svg'),
                          defeat:  loadSvgFile('assets/RedRowRonda_defeat.svg') },
    BadBlob:            { idle:    loadSvgFile('assets/BadBlob.svg'),
                          defeat:  loadSvgFile('assets/BadBlob_defeat.svg') },
    NastyKnifer:        { idle:    loadSvgFile('assets/NastyKnifer.svg'),
                          defeat:  loadSvgFile('assets/NastyKnifer_defeat.svg') },
    LowGoblin:          { idle:    loadSvgFile('assets/LowGoblin.svg'),
                          defeat:  loadSvgFile('assets/LowGoblin_defeat.svg') },
    NunChuckLarry:      { idle:    loadSvgFile('assets/NunChuckLarry.svg'),
                          defeat:  loadSvgFile('assets/NunChuckLarry_defeat.svg') },
    DivaMohawk:         { idle:    loadSvgFile('assets/DivaMohawk.svg'),
                          defeat:  loadSvgFile('assets/DivaMohawk_defeat.svg') },
    SlenderCriminal:    { idle:    loadSvgFile('assets/SlenderCriminal.svg'),
                          defeat:  loadSvgFile('assets/SlenderCriminal_defeat.svg') },
    MaskedMayhem:       { idle:    loadSvgFile('assets/MaskedMayhem.svg'),
                          defeat:  loadSvgFile('assets/MaskedMayhem_defeat.svg') },
    HyJungScout:        { idle:    loadSvgFile('assets/HyJungScout.svg'),
                          walk:    loadSvgFile('assets/HyJungScout_walk_1.svg'),
                          walk2:   loadSvgFile('assets/HyJungScout_walk_2.svg'),
                          attack:  loadSvgFile('assets/HyJungScout_attack.svg'),
                          defeat:  loadSvgFile('assets/HyJungScout_defeat.svg') },
    NinjaWarriorOfCrime:{ idle:    loadSvgFile('assets/NinjaWarriorOfCrime.svg'),
                          defeat:  loadSvgFile('assets/NinjaWarriorOfCrime_defeat.svg') },
    SquirrlyGambler:    { idle:    loadSvgFile('assets/SquirrlyGambler.svg'),
                          defeat:  loadSvgFile('assets/SquirrlyGambler_defeat.svg') },
    BruteBreaker:       { idle:    loadSvgFile('assets/BruteBreaker.svg'),
                          defeat:  loadSvgFile('assets/BruteBreaker_defeat.svg') },
};

// ── Hit effects ───────────────────────────────────────────────────────────────
// Note 10: Three impact tiers — 'small' for punches, 'medium' for kicks/most attacks,
// 'hard' for uppercutting/special moves. The tier controls both the sprite and the
// display size/duration defined in HitFX (see game.js). To add a new tier,
// add a key here, update the HitFX constructor's 'dur' and 'sz' lookup tables,
// and reference the new key when calling _doAttack.
const EFFECTS = {
    small:   loadSvgFile('assets/Object_FadingImpact.svg'),
    medium:  loadSvgFile('assets/Object_FadingImpact_2.svg'),
    hard:    loadSvgFile('assets/Object_HardImpact.svg'),
    impact1: loadSvgFile('assets/Object_ImpactEffect.svg'),
    impact2: loadSvgFile('assets/Object_ImpactEffect_2.svg'),
};

// ── Interactable objects ──────────────────────────────────────────────────────
// Note 11: OBJECTS holds sprites for the breakable crates/barrels and health pickups.
// 'intact' and 'broken' are swapped by BreakableObj.draw() based on the 'broken' flag.
// 'health' is drawn by the Pickup class. To add a second pickup type (e.g. 'power'),
// add a key here, give Pickup a 'type' check, and draw the correct sprite accordingly.
const OBJECTS = {
    intact:  loadSvgFile('assets/Object_Box.svg'),
    broken:  loadSvgFile('assets/Object_Box_Broken.svg'),
    health:  loadSvgFile('assets/Object_Health.svg'),
};

// ── Stage backgrounds ─────────────────────────────────────────────────────────
// Note 12: makeBg wraps arbitrary SVG markup in a fixed 1600x600 SVG root element.
// The canvas is 800x600, so each background image is exactly 2 screen-widths wide.
// drawBg() in game.js tiles two copies side-by-side and shifts them using parallax,
// creating an infinite scrolling effect without needing to preload multiple images.
// Note 13: The template literal (`...${body}...`) lets us compose the final SVG string
// by interpolating the scene-specific shapes into the shared wrapper. This is a common
// technique for building dynamic SVG or HTML content in plain JavaScript.
function makeBg(body) {
    return loadSvgImg(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600">${body}</svg>`);
}

// Note 14: BACKGROUNDS is an array indexed by STAGES[n].bgIdx in game.js.
// To add a fourth stage background, append another makeBg(...) call here and
// set bgIdx:3 in the matching STAGES entry. The draw code picks it automatically.
const BACKGROUNDS = [
// ── Stage 1: The Streets — noir city at night ─────────────────────────────────
// Note 15: Each background is a self-contained SVG scene. The coordinate system is
// (0,0) at top-left; x increases right, y increases down. The walkable ground zone
// starts at y=390 and ends at y=600 (bottom of canvas). Everything above y=390 is
// pure scenery that characters never interact with. SVG <defs> hold reusable gradients
// referenced by id (e.g. url(#sk1)) later in the same document.
makeBg(`
  <defs>
    <linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#04091a"/><stop offset="100%" stop-color="#111d34"/>
    </linearGradient>
    <radialGradient id="rg1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe590" stop-opacity=".45"/>
      <stop offset="100%" stop-color="#ffe590" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="390" fill="url(#sk1)"/>
  <!-- Stars -->
  <rect x="55" y="18" width="2" height="2" fill="#fff" opacity=".75"/>
  <rect x="130" y="44" width="1" height="1" fill="#fff" opacity=".6"/>
  <rect x="215" y="12" width="2" height="2" fill="#fff" opacity=".8"/>
  <rect x="318" y="32" width="1" height="1" fill="#fff" opacity=".9"/>
  <rect x="425" y="22" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="510" y="8"  width="1" height="1" fill="#fff" opacity=".8"/>
  <rect x="648" y="36" width="2" height="2" fill="#fff" opacity=".55"/>
  <rect x="730" y="14" width="1" height="1" fill="#fff" opacity=".7"/>
  <rect x="820" y="28" width="2" height="2" fill="#fff" opacity=".85"/>
  <rect x="955" y="10" width="1" height="1" fill="#fff" opacity=".65"/>
  <rect x="1060" y="34" width="2" height="2" fill="#fff" opacity=".7"/>
  <rect x="1150" y="18" width="1" height="1" fill="#fff" opacity=".9"/>
  <rect x="1250" y="44" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="1390" y="16" width="1" height="1" fill="#fff" opacity=".75"/>
  <rect x="1500" y="30" width="2" height="2" fill="#fff" opacity=".6"/>
  <rect x="85"  y="62" width="1" height="1" fill="#fff" opacity=".4"/>
  <rect x="190" y="74" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="355" y="55" width="1" height="1" fill="#fff" opacity=".55"/>
  <rect x="590" y="68" width="2" height="2" fill="#fff" opacity=".45"/>
  <rect x="790" y="72" width="1" height="1" fill="#fff" opacity=".65"/>
  <rect x="1030" y="58" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="1210" y="70" width="1" height="1" fill="#fff" opacity=".6"/>
  <rect x="1460" y="52" width="2" height="2" fill="#fff" opacity=".45"/>
  <!-- Moon -->
  <circle cx="1460" cy="62" r="26" fill="#f0e0a0" opacity=".9"/>
  <circle cx="1452" cy="57" r="25" fill="#0e1c30" opacity=".65"/>
  <!-- Back buildings (dark silhouette) -->
  <rect x="0"    y="155" width="165" height="235" fill="#0c1522"/>
  <rect x="170"  y="95"  width="200" height="295" fill="#0e1926"/>
  <rect x="395"  y="145" width="150" height="245" fill="#0b1420"/>
  <rect x="575"  y="85"  width="230" height="305" fill="#0d1825"/>
  <rect x="825"  y="55"  width="255" height="335" fill="#0c1623"/>
  <rect x="1110" y="125" width="205" height="265" fill="#0d1724"/>
  <rect x="1345" y="95"  width="215" height="295" fill="#0b1521"/>
  <!-- Mid buildings (slightly lighter) -->
  <rect x="0"    y="180" width="120" height="210" fill="#141f30"/>
  <rect x="230"  y="130" width="140" height="260" fill="#16223a"/>
  <rect x="430"  y="170" width="110" height="220" fill="#111e2d"/>
  <rect x="620"  y="120" width="170" height="270" fill="#152035"/>
  <rect x="870"  y="100" width="185" height="290" fill="#131e2e"/>
  <rect x="1155" y="150" width="155" height="240" fill="#141f31"/>
  <rect x="1390" y="120" width="170" height="270" fill="#111d2c"/>
  <!-- Windows — warm/orange for lit rooms -->
  <rect x="20"  y="200" width="24" height="30" fill="#c87820" opacity=".8"/>
  <rect x="58"  y="200" width="24" height="30" fill="#3a5a9a" opacity=".45"/>
  <rect x="20"  y="248" width="24" height="30" fill="#c87820" opacity=".65"/>
  <rect x="58"  y="248" width="24" height="30" fill="#c87820" opacity=".9"/>
  <rect x="96"  y="200" width="24" height="30" fill="#3a5a9a" opacity=".5"/>
  <rect x="250" y="158" width="28" height="34" fill="#c87820" opacity=".75"/>
  <rect x="292" y="158" width="28" height="34" fill="#3a5a9a" opacity=".55"/>
  <rect x="334" y="158" width="28" height="34" fill="#c87820" opacity=".8"/>
  <rect x="250" y="208" width="28" height="34" fill="#3a5a9a" opacity=".5"/>
  <rect x="292" y="208" width="28" height="34" fill="#c87820" opacity=".7"/>
  <rect x="640" y="148" width="32" height="38" fill="#c04020" opacity=".75"/>
  <rect x="686" y="148" width="32" height="38" fill="#3a5a9a" opacity=".6"/>
  <rect x="732" y="148" width="32" height="38" fill="#c87820" opacity=".85"/>
  <rect x="640" y="202" width="32" height="38" fill="#c87820" opacity=".5"/>
  <rect x="686" y="202" width="32" height="38" fill="#c04020" opacity=".65"/>
  <rect x="888" y="88"  width="36" height="42" fill="#c87820" opacity=".8"/>
  <rect x="940" y="88"  width="36" height="42" fill="#3a5a9a" opacity=".55"/>
  <rect x="992" y="88"  width="36" height="42" fill="#c87820" opacity=".7"/>
  <rect x="888" y="148" width="36" height="42" fill="#3a5a9a" opacity=".45"/>
  <rect x="992" y="148" width="36" height="42" fill="#c04020" opacity=".8"/>
  <!-- Neon signs -->
  <rect x="232" y="130" width="96" height="18" fill="none" stroke="#e83050" stroke-width="2.5" opacity=".9"/>
  <rect x="235" y="133" width="90" height="12" fill="#e83050" opacity=".2"/>
  <rect x="880" y="98"  width="76" height="16" fill="none" stroke="#20c0e0" stroke-width="2" opacity=".8"/>
  <rect x="883" y="101" width="70" height="10" fill="#20c0e0" opacity=".2"/>
  <!-- Fire escapes -->
  <line x1="400" y1="148" x2="400" y2="340" stroke="#883030" stroke-width="3"/>
  <line x1="420" y1="148" x2="420" y2="340" stroke="#883030" stroke-width="3"/>
  <line x1="396" y1="165" x2="424" y2="165" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="190" x2="424" y2="190" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="215" x2="424" y2="215" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="240" x2="424" y2="240" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="265" x2="424" y2="265" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="290" x2="424" y2="290" stroke="#883030" stroke-width="2"/>
  <line x1="396" y1="315" x2="424" y2="315" stroke="#883030" stroke-width="2"/>
  <!-- Ground / Road -->
  <rect y="390" width="1600" height="210" fill="#1e1e1e"/>
  <rect y="390" width="1600" height="22" fill="#2a2a2a"/>
  <line x1="0" y1="412" x2="1600" y2="412" stroke="#111" stroke-width="2"/>
  <!-- Road dashes -->
  <line x1="0" y1="488" x2="1600" y2="488" stroke="#484848" stroke-width="2" stroke-dasharray="52,44" opacity=".6"/>
  <!-- Sidewalk cracks -->
  <line x1="340"  y1="395" x2="355" y2="412" stroke="#111" stroke-width="1" opacity=".4"/>
  <line x1="820"  y1="395" x2="830" y2="410" stroke="#111" stroke-width="1" opacity=".4"/>
  <line x1="1240" y1="396" x2="1252" y2="411" stroke="#111" stroke-width="1" opacity=".4"/>
  <!-- Street lights -->
  <rect x="278"  y="318" width="5" height="74" fill="#555"/>
  <rect x="252"  y="314" width="34" height="5" fill="#555"/>
  <ellipse cx="252" cy="313" rx="18" ry="6" fill="#ffe590" opacity=".55"/>
  <ellipse cx="252" cy="310" rx="28" ry="10" fill="url(#rg1)"/>
  <rect x="878"  y="310" width="5" height="82" fill="#555"/>
  <rect x="852"  y="306" width="34" height="5" fill="#555"/>
  <ellipse cx="852" cy="305" rx="18" ry="6" fill="#ffe590" opacity=".55"/>
  <ellipse cx="852" cy="302" rx="28" ry="10" fill="url(#rg1)"/>
  <rect x="1378" y="314" width="5" height="78" fill="#555"/>
  <rect x="1352" y="310" width="34" height="5" fill="#555"/>
  <ellipse cx="1352" cy="309" rx="18" ry="6" fill="#ffe590" opacity=".55"/>
  <ellipse cx="1352" cy="306" rx="28" ry="10" fill="url(#rg1)"/>
  <!-- Fire hydrant -->
  <rect x="560" y="394" width="13" height="17" fill="#c03030" rx="2"/>
  <rect x="556" y="405" width="21" height="5" fill="#a02020" rx="1"/>
  <!-- Dumpster -->
  <rect x="1080" y="375" width="55" height="40" fill="#2a4a2a" rx="2"/>
  <rect x="1082" y="371" width="51" height="8"  fill="#1e3a1e" rx="1"/>
  <!-- Ground depth overlay -->
  <rect y="390" width="1600" height="210" fill="#000" opacity=".12"/>
`),

// Note 16: Stage 2 shares the same SVG structure but uses a different palette and set of
// props (warehouses, cranes, water). Gradient ids are unique per stage (sk2, wt2) to avoid
// collisions when both SVGs exist in memory as separate Image objects at the same time.
makeBg(`
  <defs>
    <linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#040e18"/><stop offset="100%" stop-color="#0a1e2e"/>
    </linearGradient>
    <linearGradient id="wt2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c2234"/><stop offset="100%" stop-color="#0a1a28"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="390" fill="url(#sk2)"/>
  <!-- Stars -->
  <rect x="40"  y="22" width="2" height="2" fill="#fff" opacity=".6"/>
  <rect x="115" y="38" width="1" height="1" fill="#fff" opacity=".75"/>
  <rect x="230" y="14" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="360" y="28" width="1" height="1" fill="#fff" opacity=".8"/>
  <rect x="480" y="18" width="2" height="2" fill="#fff" opacity=".55"/>
  <rect x="620" y="10" width="1" height="1" fill="#fff" opacity=".65"/>
  <rect x="740" y="30" width="2" height="2" fill="#fff" opacity=".7"/>
  <rect x="860" y="16" width="1" height="1" fill="#fff" opacity=".8"/>
  <rect x="980" y="36" width="2" height="2" fill="#fff" opacity=".5"/>
  <rect x="1100" y="12" width="1" height="1" fill="#fff" opacity=".75"/>
  <rect x="1220" y="42" width="2" height="2" fill="#fff" opacity=".6"/>
  <rect x="1340" y="20" width="1" height="1" fill="#fff" opacity=".85"/>
  <rect x="1480" y="34" width="2" height="2" fill="#fff" opacity=".55"/>
  <rect x="170" y="60" width="1" height="1" fill="#fff" opacity=".4"/>
  <rect x="430" y="55" width="2" height="2" fill="#fff" opacity=".45"/>
  <rect x="710" y="65" width="1" height="1" fill="#fff" opacity=".5"/>
  <rect x="1010" y="58" width="2" height="2" fill="#fff" opacity=".4"/>
  <rect x="1280" y="68" width="1" height="1" fill="#fff" opacity=".55"/>
  <!-- Moon (reflection on water below) -->
  <circle cx="1350" cy="55" r="22" fill="#d8e8f0" opacity=".85"/>
  <circle cx="1344" cy="50" r="21" fill="#061420" opacity=".6"/>
  <!-- Water Moon Reflection -->
  <ellipse cx="1350" cy="450" rx="14" ry="50" fill="#1a3a50" opacity=".4"/>
  <!-- Warehouses (boxy, no ornament) -->
  <rect x="0"    y="180" width="220" height="210" fill="#0d1e2c"/>
  <rect x="240"  y="150" width="280" height="240" fill="#0b1c2a"/>
  <rect x="545"  y="195" width="200" height="195" fill="#0a1b28"/>
  <rect x="775"  y="140" width="265" height="250" fill="#0c1d2c"/>
  <rect x="1070" y="170" width="240" height="220" fill="#0b1c2a"/>
  <rect x="1340" y="155" width="260" height="235" fill="#0a1b28"/>
  <!-- Warehouse doors / loading bays -->
  <rect x="40"   y="290" width="60" height="100" fill="#060f18"/>
  <rect x="320"  y="280" width="80" height="110" fill="#060f18"/>
  <rect x="810"  y="275" width="90" height="115" fill="#060f18"/>
  <rect x="1130" y="285" width="70" height="105" fill="#060f18"/>
  <!-- Warehouse windows (cold blue) -->
  <rect x="140" y="208" width="32" height="22" fill="#1a4a7a" opacity=".5"/>
  <rect x="182" y="208" width="32" height="22" fill="#1a4a7a" opacity=".3"/>
  <rect x="140" y="244" width="32" height="22" fill="#1a90a0" opacity=".5"/>
  <rect x="280" y="178" width="36" height="24" fill="#1a4a7a" opacity=".6"/>
  <rect x="328" y="178" width="36" height="24" fill="#1a90a0" opacity=".5"/>
  <rect x="380" y="178" width="36" height="24" fill="#1a4a7a" opacity=".35"/>
  <rect x="440" y="178" width="36" height="24" fill="#1a90a0" opacity=".6"/>
  <rect x="800" y="168" width="38" height="26" fill="#1a4a7a" opacity=".65"/>
  <rect x="852" y="168" width="38" height="26" fill="#1a90a0" opacity=".5"/>
  <rect x="908" y="168" width="38" height="26" fill="#1a4a7a" opacity=".4"/>
  <rect x="800" y="210" width="38" height="26" fill="#1a90a0" opacity=".6"/>
  <rect x="908" y="210" width="38" height="26" fill="#1a4a7a" opacity=".5"/>
  <!-- Warning lights on warehouse roof -->
  <circle cx="220"  cy="180" r="5" fill="#e04a00" opacity=".9"/>
  <circle cx="540"  cy="152" r="5" fill="#e04a00" opacity=".9"/>
  <circle cx="1070" cy="172" r="5" fill="#e04a00" opacity=".9"/>
  <!-- Crane structure -->
  <rect x="1510" y="60"  width="12" height="330" fill="#1a3040"/>
  <rect x="1380" y="60"  width="132" height="10" fill="#1a3040"/>
  <rect x="1380" y="60"  width="10" height="100" fill="#1a3040"/>
  <line x1="1510" y1="65" x2="1430" y2="155" stroke="#254050" stroke-width="4"/>
  <line x1="1510" y1="65" x2="1385" y2="155" stroke="#254050" stroke-width="3"/>
  <!-- Crane cable with hook -->
  <line x1="1435" y1="70" x2="1435" y2="200" stroke="#444" stroke-width="2"/>
  <rect x="1429" y="200" width="12" height="6" fill="#555"/>
  <!-- Shipping containers -->
  <rect x="0"   y="350" width="120" height="55" fill="#8b3010" rx="2"/>
  <rect x="5"   y="353" width="110" height="49" fill="none" stroke="#6a2008" stroke-width="2" opacity=".6"/>
  <rect x="130" y="355" width="100" height="45" fill="#1a6a30" rx="2"/>
  <rect x="490" y="345" width="110" height="50" fill="#1a3a8a" rx="2"/>
  <rect x="610" y="350" width="95"  height="45" fill="#8a7010" rx="2"/>
  <rect x="1100" y="348" width="115" height="48" fill="#8b3010" rx="2"/>
  <rect x="1225" y="352" width="100" height="44" fill="#1a8060" rx="2"/>
  <!-- Bollards along dock edge -->
  <rect x="90"  y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <rect x="305" y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <rect x="550" y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <rect x="800" y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <rect x="1050" y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <rect x="1300" y="382" width="10" height="20" fill="#4a4a4a" rx="1"/>
  <!-- Water / dock ground -->
  <rect y="390" width="1600" height="210" fill="url(#wt2)"/>
  <!-- Dock planks -->
  <line x1="0" y1="395" x2="1600" y2="395" stroke="#0e2838" stroke-width="3"/>
  <line x1="0" y1="410" x2="1600" y2="410" stroke="#0e2838" stroke-width="2"/>
  <line x1="0" y1="422" x2="1600" y2="422" stroke="#0e2838" stroke-width="2"/>
  <line x1="0" y1="434" x2="1600" y2="434" stroke="#0e2838" stroke-width="2"/>
  <!-- Water shimmer lines -->
  <line x1="0" y1="460" x2="1600" y2="460" stroke="#184060" stroke-width="1" stroke-dasharray="80,40" opacity=".5"/>
  <line x1="0" y1="490" x2="1600" y2="490" stroke="#184060" stroke-width="1" stroke-dasharray="60,60" opacity=".4"/>
  <line x1="0" y1="520" x2="1600" y2="520" stroke="#184060" stroke-width="1" stroke-dasharray="90,30" opacity=".3"/>
  <!-- Oil barrels -->
  <ellipse cx="475" cy="397" rx="16" ry="12" fill="#222"/>
  <ellipse cx="475" cy="389" rx="16" ry="12" fill="#3a3a3a"/>
  <ellipse cx="508" cy="397" rx="16" ry="12" fill="#222"/>
  <ellipse cx="508" cy="389" rx="16" ry="12" fill="#303030"/>
  <rect x="459" y="389" width="32" height="8" fill="#333" opacity=".8"/>
  <rect x="492" y="389" width="32" height="8" fill="#2a2a2a" opacity=".8"/>
  <rect y="390" width="1600" height="210" fill="#000" opacity=".1"/>
`),

// ── Stage 3: The Hideout — red industrial compound ────────────────────────────
// Note 17: Stage 3 uses a red-orange industrial theme with pipes, warning stripes,
// and flaming barrels. The SVG layering order matters: elements drawn later appear
// in front. The final semi-transparent black rect on the ground (opacity=".15") adds
// a consistent depth-darkening effect shared across all three stages.
makeBg(`
  <defs>
    <linearGradient id="sk3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#150208"/><stop offset="100%" stop-color="#280a10"/>
    </linearGradient>
    <linearGradient id="gr3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a1010"/><stop offset="100%" stop-color="#1c0a0a"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="390" fill="url(#sk3)"/>
  <!-- Smoke/haze wisps -->
  <ellipse cx="300"  cy="200" rx="80" ry="28" fill="#3a1010" opacity=".3"/>
  <ellipse cx="800"  cy="160" rx="100" ry="32" fill="#3a1010" opacity=".25"/>
  <ellipse cx="1300" cy="180" rx="90"  ry="28" fill="#3a1010" opacity=".3"/>
  <!-- Back buildings (rusted industrial) -->
  <rect x="0"    y="130" width="190" height="260" fill="#1e0a0a"/>
  <rect x="210"  y="100" width="225" height="290" fill="#200c0c"/>
  <rect x="460"  y="155" width="180" height="235" fill="#1c0808"/>
  <rect x="665"  y="90"  width="240" height="300" fill="#1e0a0a"/>
  <rect x="930"  y="70"  width="260" height="320" fill="#1d0909"/>
  <rect x="1220" y="115" width="215" height="275" fill="#200b0b"/>
  <rect x="1460" y="95"  width="140" height="295" fill="#1c0808"/>
  <!-- Industrial pipes on exterior walls -->
  <rect x="190"  y="102" width="20" height="288" fill="#2e1010" rx="2"/>
  <rect x="460"  y="158" width="18" height="232" fill="#2c0e0e" rx="2"/>
  <rect x="665"  y="92"  width="22" height="298" fill="#2e1010" rx="2"/>
  <rect x="1220" y="117" width="18" height="273" fill="#2c0e0e" rx="2"/>
  <!-- Pipe connectors (horizontal) -->
  <rect x="142" y="200" width="68" height="14" fill="#3a1414" rx="3"/>
  <rect x="412" y="230" width="68" height="14" fill="#3a1414" rx="3"/>
  <rect x="617" y="190" width="68" height="14" fill="#3a1414" rx="3"/>
  <rect x="1172" y="215" width="68" height="14" fill="#3a1414" rx="3"/>
  <!-- Warning stripes on one building -->
  <rect x="460" y="310" width="180" height="80" fill="#3a1404"/>
  <line x1="460" y1="310" x2="640" y2="390" stroke="#e8a000" stroke-width="12" opacity=".55"/>
  <line x1="502" y1="310" x2="640" y2="359" stroke="#e8a000" stroke-width="12" opacity=".55"/>
  <line x1="544" y1="310" x2="640" y2="327" stroke="#e8a000" stroke-width="12" opacity=".55"/>
  <line x1="460" y1="358" x2="582" y2="390" stroke="#e8a000" stroke-width="12" opacity=".55"/>
  <line x1="460" y1="342" x2="530" y2="390" stroke="#e8a000" stroke-width="12" opacity=".55"/>
  <rect x="460" y="310" width="180" height="80" fill="none" stroke="#e8a000" stroke-width="3" opacity=".7"/>
  <!-- Lit windows (red-orange glow) -->
  <rect x="25"  y="165" width="28" height="34" fill="#c84010" opacity=".75"/>
  <rect x="68"  y="165" width="28" height="34" fill="#9a2010" opacity=".5"/>
  <rect x="25"  y="215" width="28" height="34" fill="#9a2010" opacity=".65"/>
  <rect x="68"  y="215" width="28" height="34" fill="#c84010" opacity=".8"/>
  <rect x="110" y="165" width="28" height="34" fill="#c84010" opacity=".5"/>
  <rect x="240" y="130" width="32" height="38" fill="#c84010" opacity=".7"/>
  <rect x="286" y="130" width="32" height="38" fill="#9a2010" opacity=".5"/>
  <rect x="332" y="130" width="32" height="38" fill="#c84010" opacity=".8"/>
  <rect x="240" y="184" width="32" height="38" fill="#9a2010" opacity=".6"/>
  <rect x="332" y="184" width="32" height="38" fill="#c84010" opacity=".55"/>
  <rect x="692" y="118" width="36" height="42" fill="#c84010" opacity=".65"/>
  <rect x="744" y="118" width="36" height="42" fill="#9a2010" opacity=".5"/>
  <rect x="796" y="118" width="36" height="42" fill="#c84010" opacity=".8"/>
  <rect x="692" y="178" width="36" height="42" fill="#9a2010" opacity=".4"/>
  <rect x="796" y="178" width="36" height="42" fill="#c84010" opacity=".7"/>
  <rect x="960" y="98"  width="40" height="46" fill="#c84010" opacity=".75"/>
  <rect x="1015" y="98" width="40" height="46" fill="#9a2010" opacity=".55"/>
  <rect x="1072" y="98" width="40" height="46" fill="#c84010" opacity=".8"/>
  <rect x="960" y="162" width="40" height="46" fill="#9a2010" opacity=".5"/>
  <rect x="1072" y="162" width="40" height="46" fill="#c84010" opacity=".6"/>
  <!-- Flaming barrels (light source) -->
  <ellipse cx="155" cy="386" rx="18" ry="8" fill="#1a0505"/>
  <ellipse cx="155" cy="371" rx="18" ry="8" fill="#2a0808"/>
  <rect x="137" y="371" width="36" height="15" fill="#2a0808"/>
  <ellipse cx="155" cy="358" rx="12" ry="28" fill="#e04000" opacity=".55"/>
  <ellipse cx="155" cy="348" rx="8"  ry="20" fill="#ff8000" opacity=".5"/>
  <ellipse cx="755" cy="386" rx="18" ry="8" fill="#1a0505"/>
  <ellipse cx="755" cy="371" rx="18" ry="8" fill="#2a0808"/>
  <rect x="737" y="371" width="36" height="15" fill="#2a0808"/>
  <ellipse cx="755" cy="358" rx="12" ry="28" fill="#e04000" opacity=".55"/>
  <ellipse cx="755" cy="348" rx="8"  ry="20" fill="#ff8000" opacity=".5"/>
  <ellipse cx="1355" cy="386" rx="18" ry="8" fill="#1a0505"/>
  <ellipse cx="1355" cy="371" rx="18" ry="8" fill="#2a0808"/>
  <rect x="1337" y="371" width="36" height="15" fill="#2a0808"/>
  <ellipse cx="1355" cy="358" rx="12" ry="28" fill="#e04000" opacity=".55"/>
  <ellipse cx="1355" cy="348" rx="8"  ry="20" fill="#ff8000" opacity=".5"/>
  <!-- Chain-link fence silhouette -->
  <line x1="0" y1="370" x2="1600" y2="370" stroke="#3a1010" stroke-width="3"/>
  <line x1="0" y1="370" x2="1600" y2="382" stroke="#2a0a0a" stroke-width="1" stroke-dasharray="18,12" opacity=".5"/>
  <line x1="0" y1="382" x2="1600" y2="370" stroke="#2a0a0a" stroke-width="1" stroke-dasharray="18,12" opacity=".5"/>
  <!-- Ground — concrete / industrial floor -->
  <rect y="390" width="1600" height="210" fill="url(#gr3)"/>
  <!-- Floor cracks -->
  <line x1="0"   y1="400" x2="1600" y2="400" stroke="#1a0808" stroke-width="3"/>
  <line x1="200" y1="400" x2="210"  y2="430" stroke="#140606" stroke-width="1" opacity=".6"/>
  <line x1="600" y1="400" x2="614"  y2="440" stroke="#140606" stroke-width="1" opacity=".6"/>
  <line x1="1100" y1="400" x2="1112" y2="435" stroke="#140606" stroke-width="1" opacity=".6"/>
  <!-- Floor grid effect -->
  <line x1="0" y1="455" x2="1600" y2="455" stroke="#200808" stroke-width="2" stroke-dasharray="48,32" opacity=".5"/>
  <line x1="0" y1="505" x2="1600" y2="505" stroke="#200808" stroke-width="2" stroke-dasharray="48,32" opacity=".4"/>
  <!-- Overhead warning sign -->
  <rect x="680" y="370" width="240" height="28" fill="#301008"/>
  <rect x="682" y="372" width="236" height="24" fill="#e8a000" opacity=".12"/>
  <rect x="682" y="372" width="236" height="24" fill="none" stroke="#e8a000" stroke-width="2" opacity=".7"/>
  <rect y="390" width="1600" height="210" fill="#000" opacity=".15"/>
`),
];

// Resolves once every sprite loaded by loadSvgFile has finished decoding.
// game.js awaits this before starting the game loop.
const ASSETS_READY = Promise.all(_decodePromises);

// js/sprites/ready.js — Asset decode gate
// Resolves once every sprite has been fetched and has finished decoding.
// game.js awaits ASSETS_READY before starting the game loop so ctx.drawImage()
// always has valid pixel data on the first frame.
//
// Two phases, in order. The sprite modules fetch in parallel rather than one
// blocking request at a time, so their images do not all exist yet at the
// moment this file runs: ENEMY_CHARS_READY covers the enemy build and
// SVG_FILES_READY the batch every other module registers. Only once both have
// settled is _decodePromises the full list, which is why Promise.all over it
// waits until then instead of being taken now.
const ASSETS_READY = Promise.all([
    typeof ENEMY_CHARS_READY !== 'undefined' ? ENEMY_CHARS_READY : null,
    typeof SVG_FILES_READY   !== 'undefined' ? SVG_FILES_READY   : null,
]).then(() => Promise.all(_decodePromises));

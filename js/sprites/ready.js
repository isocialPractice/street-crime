// js/sprites/ready.js — Asset decode gate
// Resolves once every sprite loaded by loadSvgFile has finished decoding.
// game.js awaits ASSETS_READY before starting the game loop so ctx.drawImage()
// always has valid pixel data on the first frame.
const ASSETS_READY = Promise.all(_decodePromises);

// js/core/canvas.js — Canvas context and DOM element references
// Grabbed once at startup and reused everywhere. W and H avoid repeated
// property lookups inside the render loop.

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// HUD DOM references — updated via .textContent, .style.width, or classList.
const scoreEl      = document.getElementById('score');
const livesEl      = document.getElementById('lives');
const healthFill   = document.getElementById('health-fill');
const staminaBar   = document.getElementById('stamina-bar');
const staminaFill  = document.getElementById('stamina-fill');
const stageEl      = document.getElementById('stage');
const comboDisplay = document.getElementById('combo-display');
const comboEl      = document.getElementById('combo');
const bossHud      = document.getElementById('boss-hud');
const bossNameEl   = document.getElementById('boss-name');
const bossFill     = document.getElementById('boss-health-fill');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');
const pauseBtn     = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');

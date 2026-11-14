// js/core/input.js — Keyboard input state
// Keys      — true while a key is held down (use for movement, held actions).
// JustPressed — true only on the FIRST frame a key is pressed (use for one-shot
//               actions like jump/attack so tapping once fires exactly one action).
// Keys are identified by e.code (physical key, layout-independent).

const Keys = {};
const JustPressed = {};

window.addEventListener('keydown', e => {
    // An overlay over the game (js/ui/overlay.js) takes every key while it is
    // open: none reaches the player, and P and Esc do not pause.
    if (typeof GameUI !== 'undefined' && GameUI.isOpen()) {
        if (GameUI.key(e)) e.preventDefault();
        return;
    }
    // Ctrl+I opens the command line (js/ui/parser.js), and I or Tab the item
    // screen (js/ui/inventory-screen.js), while playing. Not while typing into
    // a debug panel's field; Tab never moves focus during play, and Ctrl+I's
    // own browser action (Firefox's Page Info) is prevented.
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (!typing && gameState === 'playing' && typeof CommandLine !== 'undefined'
        && e.code === 'KeyI' && e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat) CommandLine.open();
        return;
    }
    if (!typing && gameState === 'playing' && typeof ItemScreen !== 'undefined'
        && ((e.code === 'KeyI' && !e.ctrlKey && !e.metaKey && !e.altKey) || e.code === 'Tab')) {
        e.preventDefault();
        if (!e.repeat) ItemScreen.open();
        return;
    }
    // !Keys[e.code] guard prevents JustPressed from being re-set every frame
    // while the key is held — the OS fires repeated keydown events during a hold.
    if (!Keys[e.code]) JustPressed[e.code] = true;
    Keys[e.code] = true;
    // Prevent browser scrolling on arrow keys and Space during gameplay.
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault();
    if ((e.code === 'KeyP' || e.code === 'Escape') &&
        (gameState === 'playing' || gameState === 'paused'))
        togglePause();
});

window.addEventListener('keyup', e => { Keys[e.code] = false; });

// clearJustPressed is called at the END of each game loop iteration so that
// each "just pressed" signal lasts for exactly one frame, then disappears.
function clearJustPressed() { for (const k in JustPressed) delete JustPressed[k]; }

// js/ui/hud.js — HUD helper functions and overlay control
// All functions manipulate DOM elements declared in js/core/canvas.js.
// CSS transitions on health bar width handle smooth shrink animation automatically.

function _hpHUD(p) {
    healthFill.style.width = (p.hp / p.maxHp * 100) + '%';
}

// Update the stamina gauge for the run-kick gate. Also returns true when the
// configured per-level / per-game recharge limit has been hit so the bar gets
// a "depleted" visual treatment.
function _staminaHUD(p) {
    const pct = Math.max(0, Math.min(1, p.stamina)) * 100;
    if (staminaFill) staminaFill.style.width = pct + '%';
    if (staminaBar) {
        if (_staminaRechargeBlocked(p)) staminaBar.classList.add('depleted');
        else staminaBar.classList.remove('depleted');
    }
}

// Returns true if no further recharges are permitted under the active
// CFG.staminaLimitMode (0 = unlimited, 1 = per-level, 2 = per-game).
function _staminaRechargeBlocked(p) {
    const mode = CFG.staminaLimitMode | 0;
    if (mode === 0) return false;
    const limit = CFG.staminaLimitCount | 0;
    const count = (mode === 1) ? p.rechargeCountLevel : p.rechargeCountGame;
    return count >= limit;
}

let _bossRef = null;

function _showBossHUD(name, entity) {
    _bossRef = entity;
    bossNameEl.textContent = name;
    bossHud.classList.remove('hidden');
    bossFill.style.width = '100%';
}

function _hideBossHUD() {
    bossHud.classList.add('hidden');
    _bossRef = null;
}

function _updateBossBar(e) {
    if (!e) return;
    bossFill.style.width = (e.hp / e.maxHp * 100) + '%';
}

function _updateComboHUD(n) {
    if (n < 2) { comboDisplay.classList.add('hidden'); return; }
    comboEl.textContent = n;
    comboDisplay.classList.remove('hidden');
    // CSS animation restart trick: setting animation to 'none', reading offsetWidth
    // (forces a reflow), then restoring causes the browser to restart the keyframes.
    comboDisplay.style.animation = 'none';
    void comboDisplay.offsetWidth;
    comboDisplay.style.animation = '';
}

function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent   = sub;
    overlay.classList.remove('hidden');
}

function hideOverlay() { overlay.classList.add('hidden'); }

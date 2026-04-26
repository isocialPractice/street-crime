// js/sprites/enemies.js — Enemy character sprite sets
// ENEMY_CHARS keys must exactly match the 'img' field in ENEMY_DEFS (in js/entities/enemy.js).
// Enemy asset states are configured in config/enemy-assets.json using the enemy name
// as the base for sprite filenames so new frames can be wired in without editing JS.

function _loadEnemyAssetConfig() {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'config/enemy-assets.json', false);
        xhr.send();
        const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        return {
            defaults: parsed.defaults || {},
            wipEnemies: Array.isArray(parsed.wipEnemies) ? parsed.wipEnemies : [],
            enemies: parsed.enemies || {},
        };
    } catch (e) {
        console.warn('[enemy-assets] Could not load config/enemy-assets.json', e);
        return { defaults: {}, wipEnemies: [], enemies: {} };
    }
}

function _cloneEnemyAnimDef(def = {}) {
    return {
        mode: def.mode || 'hold',
        suffixes: Array.isArray(def.suffixes) ? [...def.suffixes] : [],
        files: Array.isArray(def.files) ? [...def.files] : null,
        fallbackState: def.fallbackState || null,
    };
}

function _mergeEnemyAssetEntry(defaults = {}, entry = {}) {
    const merged = {
        attackType: entry.attackType || defaults.attackType || 'bodyAttack',
        animations: {},
    };
    const defaultAnimations = defaults.animations || {};
    const overrideAnimations = entry.animations || {};
    const stateKeys = new Set([
        ...Object.keys(defaultAnimations),
        ...Object.keys(overrideAnimations),
    ]);

    for (const stateKey of stateKeys) {
        const animDef = _cloneEnemyAnimDef(defaultAnimations[stateKey]);
        const override = overrideAnimations[stateKey] || {};
        if (Object.prototype.hasOwnProperty.call(override, 'mode')) {
            animDef.mode = override.mode || animDef.mode;
        }
        if (Object.prototype.hasOwnProperty.call(override, 'fallbackState')) {
            animDef.fallbackState = override.fallbackState || null;
        }
        if (Object.prototype.hasOwnProperty.call(override, 'suffixes')) {
            animDef.suffixes = Array.isArray(override.suffixes) ? [...override.suffixes] : [];
            animDef.files = null;
        }
        if (Object.prototype.hasOwnProperty.call(override, 'files')) {
            animDef.files = Array.isArray(override.files) ? [...override.files] : [];
            animDef.suffixes = [];
        }
        merged.animations[stateKey] = animDef;
    }

    return merged;
}

function _enemyAssetPath(fileBase) {
    const assetPath = fileBase.startsWith('assets/') ? fileBase : `assets/${fileBase}`;
    return assetPath.endsWith('.svg') ? assetPath : `${assetPath}.svg`;
}

function _loadEnemyAnimFrames(enemyKey, animDef) {
    const fileBases = Array.isArray(animDef.files)
        ? animDef.files
        : (animDef.suffixes || []).map(suffix => (suffix ? `${enemyKey}_${suffix}` : enemyKey));
    return fileBases.map(fileBase => loadSvgFile(_enemyAssetPath(fileBase)));
}

function _firstEnemyFrame(charDef, stateKey, index = 0) {
    return charDef.animations[stateKey]?.frames?.[index] || null;
}

function _buildEnemyChar(enemyKey, defaults, entry) {
    const merged = _mergeEnemyAssetEntry(defaults, entry);
    const charDef = {
        attackType: merged.attackType,
        animations: {},
    };

    for (const [stateKey, animDef] of Object.entries(merged.animations)) {
        charDef.animations[stateKey] = {
            mode: animDef.mode,
            fallbackState: animDef.fallbackState,
            frames: _loadEnemyAnimFrames(enemyKey, animDef),
        };
    }

    charDef.idle = _firstEnemyFrame(charDef, 'idle');
    charDef.idle2 = _firstEnemyFrame(charDef, 'idle', 1);
    charDef.walk = _firstEnemyFrame(charDef, 'walk');
    charDef.walk2 = _firstEnemyFrame(charDef, 'walk', 1);
    charDef.attack = _firstEnemyFrame(charDef, 'attack');
    charDef.damage = _firstEnemyFrame(charDef, 'damage');
    charDef.damage2 = _firstEnemyFrame(charDef, 'damage', 1);
    charDef.preDefeat = _firstEnemyFrame(charDef, 'preDefeat');
    charDef.defeat = _firstEnemyFrame(charDef, 'defeat');
    return charDef;
}

const ENEMY_ASSET_CONFIG = _loadEnemyAssetConfig();

const ENEMY_CHARS = (() => {
    const built = {};
    const wipEntries = {};
    for (const enemyKey of ENEMY_ASSET_CONFIG.wipEnemies || []) {
        wipEntries[enemyKey] = {};
    }
    const mergedEntries = Object.assign({}, wipEntries, ENEMY_ASSET_CONFIG.enemies || {});
    for (const [enemyKey, entry] of Object.entries(mergedEntries)) {
        built[enemyKey] = _buildEnemyChar(enemyKey, ENEMY_ASSET_CONFIG.defaults || {}, entry);
    }
    return built;
})();

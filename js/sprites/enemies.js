// js/sprites/enemies.js — Enemy character sprite sets
// ENEMY_CHARS keys must exactly match the 'img' field in ENEMY_DEFS (in js/entities/enemy.js).
// Enemy asset states are configured in config/enemy-assets.json using the enemy name
// as the base for sprite filenames so new frames can be wired in without editing JS.
//
// Assembled animations
// --------------------
// A suffix inside a sequence may name another animation state on the same
// enemy. When it does, and no literal "<EnemyName>_<suffix>.svg" is on disk,
// that one token is replaced in place by every frame the named state resolves
// to. This lets a defeat sequence stay written as
//
//     "defeat": { "mode": "sequence", "suffixes": ["damage_2", "preDefeat", "defeat"] }
//
// whether the enemy's preDefeat is a single held pose or a multi-frame
// collapse. A literal asset always wins, so enemies that still ship a real
// "<EnemyName>_preDefeat.svg" keep using that exact file and are unaffected.
//
// Numbered ranges
// ---------------
// A suffix with no literal file and no matching state expands to the
// contiguous run "<suffix>_0", "<suffix>_1", ... for as long as those files
// exist. Dropping "SassyGirl_defeat_0.svg" and "SassyGirl_defeat_1.svg" into
// assets/ is enough to turn a one-frame defeat into a two-frame one.
//
// Attack pacing
// -------------
// The attack timings in config/enemies.json are shared by every character, so
// they can only suit one sequence length. An enemy may declare "attackTime",
// the seconds its attack frames take to play, and a long run then reads at its
// own rate without dragging out everyone else's swing. The blow keeps landing
// on the frame the artwork connects on: see Enemy._attackHitDelay.
//
// Get-ups and power attacks
// -------------------------
// An enemy may declare "canGetUp" and a "getUps" count: how many times it
// stands back up before a lethal blow finishes it. Weapon-wielding enemies get
// this by default through the attackTypeDefaults block in the config.
//
// "attackType" also takes a list, which is how a character that changes how it
// fights declares the order. Each entry after the first is an attack it only
// brings out once it has been knocked down and stood back up, so the list sets
// the get-up count too: one fewer than the number of attacks. The stage an
// enemy is on picks the animation it swings; see Enemy._attackStateKey.
//
// "powerAttack" is the optional harder swing used once an enemy has stood back
// up. When it is not authored it is derived from the attack sequence by
// swapping the final frame for "<EnemyName>_attack_powerAttack", which the
// numbered-range rule expands when attack_powerAttack_0..n exist. With no such
// asset the original final frame is kept, so powerAttack is just the normal
// attack.
//
// Weapon anchoring
// ----------------
// Frames are drawn centred on the enemy, which holds a character still only as
// long as its artboard is its body. Every artboard is cropped to its artwork,
// so a frame that brings a weapon out grows by however far the weapon reaches,
// and centring that wider frame shoves the character backward by half of it:
// the body slides back as the weapon comes out and snaps forward again when the
// attack ends.
//
// A layer whose id starts with "weapon" marks a frame that carries one, and an
// animation with any such frame in it is pinned by the back of the character
// instead. Art is authored facing right, so that is the artboard's left edge,
// and every frame from the first to the last holds it where the character's
// reference pose has its own. The body stays put and only the weapon travels.
// The facing flip is applied afterwards, around the same centre line, so on an
// enemy facing left it is the right edge that holds still on screen.
//
// Where the weapon itself reaches furthest back, as in a wind-up behind the
// shoulder, the edge is measured from the body's artwork rather than taken from
// the artboard, so the swing does not drag the character forward either.
//
// Enemies opt in with "anchorWeapon". The weaponAttack block of
// attackTypeDefaults turns it on, so a character fighting with a weapon gets it
// without restating it.

function _loadEnemyAssetConfig() {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'config/enemy-assets.json', false);
        xhr.send();
        const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        return {
            defaults: parsed.defaults || {},
            attackTypeDefaults: parsed.attackTypeDefaults || {},
            wipEnemies: Array.isArray(parsed.wipEnemies) ? parsed.wipEnemies : [],
            enemies: parsed.enemies || {},
        };
    } catch (e) {
        console.warn('[enemy-assets] Could not load config/enemy-assets.json', e);
        return { defaults: {}, attackTypeDefaults: {}, wipEnemies: [], enemies: {} };
    }
}

// Player reactions a landing blow can carry. Keys are the accepted spellings,
// values the canonical name, so "playerKnockedBack" and "playerKnockBack" both
// resolve to one mode and a config typo does not silently do nothing.
const ENEMY_EFFECT_MODES = {
    playerfreeze:                'playerFreeze',
    playerknockdown:             'playerKnockDown',
    playerknockeddown:           'playerKnockDown',
    playerknockback:             'playerKnockBack',
    playerknockedback:           'playerKnockBack',
    playertakesadditionaldamage: 'playerTakesAdditionalDamage',
};

// Reaction used when an enemy swings a real power attack without declaring what
// it should do, and when a declaration names nothing usable.
const ENEMY_DEFAULT_REACTION = 'playerFreeze';

// The effect block and its tuning values share the animations map with real
// animations, so they are recognised by name and kept out of frame loading.
function _isEnemyEffectKey(key) {
    return key === 'powerAttackEffect'
        || Object.prototype.hasOwnProperty.call(ENEMY_EFFECT_MODES, String(key).toLowerCase());
}

// _buildEnemyPowerEffect - turn the raw effect entries into the reaction a
// landing blow applies.
//
// "mode" takes a single name or a list. The documented sentinel form,
// "mode": "array" with the names in a sibling "array" property, is accepted as
// written; a plain array in "mode" works too and reads better.
//
// A tuning value may sit beside powerAttackEffect under the name of the mode it
// tunes, which is how playerFreeze sets its own duration and
// playerTakesAdditionalDamage its own multiplier.
function _buildEnemyPowerEffect(raw) {
    const params = {};
    for (const [key, value] of Object.entries(raw)) {
        if (key === 'powerAttackEffect') continue;
        const canonical = ENEMY_EFFECT_MODES[String(key).toLowerCase()];
        if (canonical && typeof value === 'number' && isFinite(value)) params[canonical] = value;
    }

    const spec = raw.powerAttackEffect;
    if (!spec || typeof spec !== 'object') return { declared: false, modes: [], params };

    let listed = spec.mode;
    if (typeof listed === 'string' && listed.toLowerCase() === 'array') listed = spec.array;
    if (typeof listed === 'string') listed = [listed];
    if (!Array.isArray(listed)) listed = [];

    const modes = [];
    for (const entry of listed) {
        const canonical = ENEMY_EFFECT_MODES[String(entry).toLowerCase()];
        if (!canonical) { console.warn('[enemy-assets] Unknown powerAttackEffect mode', entry); continue; }
        if (!modes.includes(canonical)) modes.push(canonical);
    }
    if (!modes.length) modes.push(ENEMY_DEFAULT_REACTION);
    return { declared: true, modes, params };
}

// An enemy-level "apply<State>" property names a player animation this enemy's
// hits swap in for its own. The captured group is the player state being
// replaced, and the value qualifies it, so "applyDamage": "Electrocuted"
// resolves to Player_Damage_Electrocuted_0.svg onwards.
const ENEMY_APPLY_RE = /^apply([A-Za-z]+)$/;

// _buildEnemyAppliedPlayerAnims - load the player animations an enemy applies.
//
// A plain "Player_<State>_<Variant>.svg" is used when one exists; otherwise the
// numbered-range rule picks up the contiguous run from _0. Nothing on disk
// warns and is dropped rather than leaving blank frames on the player.
function _buildEnemyAppliedPlayerAnims(layers) {
    const declared = {};
    for (const layer of layers) {
        for (const [key, value] of Object.entries(layer || {})) {
            const match = ENEMY_APPLY_RE.exec(key);
            if (match && typeof value === 'string' && value) declared[match[1]] = value;
        }
    }

    const applied = {};
    for (const [state, variant] of Object.entries(declared)) {
        const base = `Player_${state}_${variant}`;
        const bases = _enemyAssetExists(_enemyAssetPath(base)) ? [base] : _enemyRangeBases(base);
        if (!bases.length) {
            console.warn('[enemy-assets] No player sprites found for', base);
            continue;
        }
        applied[state.toLowerCase()] = bases.map(_loadEnemyFrame);
    }
    return applied;
}

function _cloneEnemyAnimDef(def = {}) {
    return {
        mode: def.mode || 'hold',
        suffixes: Array.isArray(def.suffixes) ? [...def.suffixes] : [],
        files: Array.isArray(def.files) ? [...def.files] : null,
        fallbackState: def.fallbackState || null,
    };
}

// _applyEnemyAnimOverride - fold one layer of animation config over another.
function _applyEnemyAnimOverride(animDef, override = {}) {
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
    return animDef;
}

// _pickEnemyField - first layer that actually declares the field wins, going
// from most specific (the enemy entry) to least (the global defaults).
function _pickEnemyField(field, layers, fallback) {
    for (const layer of layers) {
        if (layer && Object.prototype.hasOwnProperty.call(layer, field)) return layer[field];
    }
    return fallback;
}

// _enemyAttackTypes - the attack types an enemy works through, in order.
//
// One type is the common case and stays a plain string in the config. A list is
// how a character that changes how it fights partway through a scrap declares
// it: the first entry is what it opens with, and each later one is what it
// brings out after being knocked down and standing back up again.
function _enemyAttackTypes(value, fallback = 'bodyAttack') {
    const raw = Array.isArray(value) ? value : [value];
    const types = raw.map(name => (typeof name === 'string' ? name.trim() : '')).filter(Boolean);
    return types.length ? types : [fallback];
}

// _mergeAttackTypeDefaults - fold the attackTypeDefaults block of every type an
// enemy uses into one config layer, later types winning. A character that opens
// bodyAttack and escalates to weaponAttack picks up the weapon block's get-up
// wiring without having to restate any of it.
function _mergeAttackTypeDefaults(attackTypeDefaults = {}, types = []) {
    const merged = { animations: {} };
    for (const type of types) {
        const block = attackTypeDefaults[type];
        if (!block) continue;
        for (const [key, value] of Object.entries(block)) {
            if (key === 'animations') Object.assign(merged.animations, value || {});
            else merged[key] = value;
        }
    }
    return merged;
}

// Config layers stack: defaults < the merged attackTypeDefaults for every type
// this enemy uses < enemy entry.
function _mergeEnemyAssetEntry(defaults = {}, typeDefaults = {}, entry = {}) {
    const layers = [entry, typeDefaults, defaults];
    const attackType = _enemyAttackTypes(_pickEnemyField('attackType', [entry, defaults]));

    // A list of attack types is a list of stages, and the only way to the next
    // stage is to be knocked down and get up again, so the list itself says how
    // many get-ups the enemy has: one fewer than the number of attacks it has to
    // work through. The list is more specific than an attack-type block, which
    // knows nothing about how many attacks it is one of, and less specific than
    // the entry, which can still state either field outright.
    const stagedGetUps = attackType.length - 1;
    const canGetUp = !!_pickEnemyField('canGetUp', layers, stagedGetUps > 0);
    const getUpsDefault = stagedGetUps > 0
        ? stagedGetUps
        : Math.max(0, Number(_pickEnemyField('getUps', [typeDefaults, defaults], 0)) || 0);

    const merged = {
        attackType,
        canGetUp,
        // A get-up count is meaningless without the ability to get up, so it is
        // forced to zero rather than left as a trap for a half-written entry.
        getUps: canGetUp ? Math.max(0, Number(_pickEnemyField('getUps', [entry], getUpsDefault)) || 0) : 0,
        // Seconds this enemy's attack frames take to play, or 0 to keep the
        // shared pacing in config/enemies.json. Sequence lengths vary further
        // than one global can cover: a two frame jab and a fourteen frame
        // weapon draw cannot read at the same rate. See Enemy._attackFrameTime.
        attackTime: Math.max(0, Number(_pickEnemyField('attackTime', layers, 0)) || 0),
        // Pin armed animations by the back of the character rather than
        // centring them. See "Weapon anchoring" above.
        anchorWeapon: !!_pickEnemyField('anchorWeapon', layers, false),
        animations: {},
    };
    const defaultAnimations = defaults.animations || {};
    const typeAnimations = typeDefaults.animations || {};
    const overrideAnimations = entry.animations || {};

    // Effect entries live in the animations map but are not animations. Collect
    // them across the same layer order, most specific last, then keep them out
    // of the state keys so no frame loading is ever attempted for them.
    const rawEffects = {};
    for (const layer of [defaultAnimations, typeAnimations, overrideAnimations]) {
        for (const [key, value] of Object.entries(layer)) {
            if (_isEnemyEffectKey(key)) rawEffects[key] = value;
        }
    }
    merged.powerAttackEffect = _buildEnemyPowerEffect(rawEffects);

    const stateKeys = new Set([
        ...Object.keys(defaultAnimations),
        ...Object.keys(typeAnimations),
        ...Object.keys(overrideAnimations),
    ].filter(key => !_isEnemyEffectKey(key)));

    for (const stateKey of stateKeys) {
        const animDef = _cloneEnemyAnimDef(defaultAnimations[stateKey]);
        _applyEnemyAnimOverride(animDef, typeAnimations[stateKey] || {});
        _applyEnemyAnimOverride(animDef, overrideAnimations[stateKey] || {});
        merged.animations[stateKey] = animDef;
    }

    return merged;
}

function _enemyAssetPath(fileBase) {
    const assetPath = fileBase.startsWith('assets/') ? fileBase : `assets/${fileBase}`;
    return assetPath.endsWith('.svg') ? assetPath : `${assetPath}.svg`;
}

const _enemyAssetCache = Object.create(null);
const _enemyMissingWarned = new Set();

// _enemyAssetSource - fetch one asset and remember both whether it exists and
// what it contains. Resolution has to probe files before it can decide how to
// expand a suffix, so caching the body here means the probe and the sprite load
// that follows it share a single request instead of costing two.
//
// Synchronous XHR matches how every other asset in this module is fetched at
// startup. Over http(s) a missing file answers 404; over file:// the status is
// 0 either way, so a non-empty body is the only signal available there.
function _enemyAssetSource(path) {
    if (path in _enemyAssetCache) return _enemyAssetCache[path];
    let entry = { ok: false, text: '' };
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.send();
        const ok = (xhr.status >= 200 && xhr.status < 300)
                || (xhr.status === 0 && !!xhr.responseText);
        if (ok) entry = { ok: true, text: xhr.responseText };
    } catch (e) {
        // Unreachable or blocked reads count as absent; callers all degrade.
    }
    _enemyAssetCache[path] = entry;
    return entry;
}

function _enemyAssetExists(path) {
    return _enemyAssetSource(path).ok;
}

// Longest numbered run a single suffix may expand to. High enough for any hand
// drawn animation, low enough that a config typo cannot stall startup.
const ENEMY_RANGE_LIMIT = 64;

// _enemyRangeBases - "<fileBase>_0", "<fileBase>_1", ... while those files
// exist. The run must start at 0 and is cut at the first gap, so a stray
// "_7.svg" left behind by an edit never joins a 0..3 animation.
function _enemyRangeBases(fileBase) {
    const bases = [];
    for (let i = 0; i < ENEMY_RANGE_LIMIT; i++) {
        const numbered = `${fileBase}_${i}`;
        if (!_enemyAssetExists(_enemyAssetPath(numbered))) break;
        bases.push(numbered);
    }
    return bases;
}

function _warnMissingEnemyAsset(fileBase) {
    if (_enemyMissingWarned.has(fileBase)) return;
    _enemyMissingWarned.add(fileBase);
    console.warn('[enemy-assets] No sprite resolved for', fileBase);
}

// _loadEnemyFrame - turn a resolved file base into a decoded sprite, reusing
// the text the existence probe already pulled down. loadSvgImg records the
// authored viewBox size on the way through, which is what _enemyDrawSize scales
// against instead of the shape-dependent natural size the browser infers.
function _loadEnemyFrame(fileBase) {
    const path = _enemyAssetPath(fileBase);
    const src = _enemyAssetSource(path);
    if (!src.ok) {
        _warnMissingEnemyAsset(fileBase);
        return loadSvgImg('<svg xmlns="http://www.w3.org/2000/svg"/>');
    }
    return loadSvgImg(src.text);
}

// _enemyAnimFileBases - resolve one animation state to the list of sprite file
// bases it draws, expanding assembled animations along the way.
//
// Each suffix is resolved in this order, so an authored file always wins over
// anything inferred:
//   1. the literal "assets/<enemyKey>_<suffix>.svg",
//   2. an assembled animation - the suffix names another state in the same
//      animations map, is not the state being resolved, is not already on the
//      resolution path (cycles keep the literal name), and that state itself
//      resolves to at least one frame,
//   3. a numbered range - "<enemyKey>_<suffix>_0.svg" onwards,
//   4. nothing, in which case the frame is dropped and the state falls through
//      to its fallbackState rather than holding a blank sprite.
// 'files' entries are absolute sprite names rather than state suffixes, so they
// are returned as authored.
function _enemyAnimFileBases(enemyKey, stateKey, animations, seen) {
    const animDef = animations[stateKey];
    if (!animDef) return [];
    if (Array.isArray(animDef.files)) return [...animDef.files];

    const path = seen || new Set();
    const bases = [];
    for (const suffix of animDef.suffixes || []) {
        const fileBase = suffix ? `${enemyKey}_${suffix}` : enemyKey;
        if (_enemyAssetExists(_enemyAssetPath(fileBase))) { bases.push(fileBase); continue; }

        if (suffix && suffix !== stateKey && !path.has(suffix)
            && Object.prototype.hasOwnProperty.call(animations, suffix)) {
            const nested = _enemyAnimFileBases(
                enemyKey, suffix, animations, new Set([...path, stateKey, suffix])
            );
            if (nested.length) { bases.push(...nested); continue; }
        }

        const ranged = _enemyRangeBases(fileBase);
        if (ranged.length) { bases.push(...ranged); continue; }

        _warnMissingEnemyAsset(fileBase);
    }
    return bases;
}

function _loadEnemyAnimFrames(enemyKey, stateKey, animations) {
    return _enemyAnimFileBases(enemyKey, stateKey, animations).map(_loadEnemyFrame);
}

// _weaveEnemyPreDefeat - make sure a character's collapse is part of its death.
//
// Most defeat sequences name preDefeat themselves, and assembled animations
// expand it in place. A character that has collapse frames but whose defeat
// never mentions them would otherwise snap straight from standing to its final
// downed pose, so the collapse is prepended for it. Characters whose defeat
// already covers the collapse, and those with no collapse at all, are untouched.
function _weaveEnemyPreDefeat(bases, animations) {
    const collapse = bases.preDefeat || [];
    const defeat = bases.defeat || [];
    if (!collapse.length || !defeat.length) return;
    if (collapse.every(fileBase => defeat.includes(fileBase))) return;
    bases.defeat = [...collapse, ...defeat];
    // A single held pose cannot play a collapse, so the state becomes a run.
    if (animations.defeat) animations.defeat.mode = 'sequence';
}

function _firstEnemyFrame(charDef, stateKey, index = 0) {
    return charDef.animations[stateKey]?.frames?.[index] || null;
}

// Suffix the derived power attack swaps in for the final attack frame.
const ENEMY_POWER_ATTACK_SUFFIX = 'attack_powerAttack';

// _deriveEnemyPowerAttack - fill in the optional powerAttack state.
//
// Only enemies that can get up ever swing it, so nothing is derived for the
// rest. An authored powerAttack is left exactly as written; otherwise the
// attack sequence is copied with its final frame swapped for
// "<enemyKey>_attack_powerAttack". The numbered-range rule then expands that to
// attack_powerAttack_0..n when those files exist. With neither the plain file
// nor a numbered set on disk the original final frame stays put, which makes
// the derived state identical to the normal attack.
function _deriveEnemyPowerAttack(enemyKey, merged) {
    const power = merged.animations.powerAttack;
    if (!power) return;
    if (power.files || (power.suffixes && power.suffixes.length)) return;

    const attack = merged.animations.attack;
    const suffixes = (attack && !attack.files && Array.isArray(attack.suffixes))
        ? attack.suffixes
        : [];
    if (!suffixes.length) return;

    const swapped = [...suffixes];
    const powerBase = `${enemyKey}_${ENEMY_POWER_ATTACK_SUFFIX}`;
    const hasPowerAsset = _enemyAssetExists(_enemyAssetPath(powerBase))
        || _enemyRangeBases(powerBase).length > 0;
    if (hasPowerAsset) swapped[swapped.length - 1] = ENEMY_POWER_ATTACK_SUFFIX;

    power.mode = attack.mode;
    power.suffixes = swapped;
    power.files = null;
}

// Layer ids that mark weapon artwork: "weapon", "weapon-dark", "weapon_2" and
// the like. A longer word such as "weaponAttack" is a name, not a weapon layer.
const ENEMY_WEAPON_ID_RE = /^weapon(?![a-z])/i;

function _enemyWeaponLayers(root) {
    return [...root.querySelectorAll('[id]')].filter(el => ENEMY_WEAPON_ID_RE.test(el.id));
}

// _measureEnemyBodyBackX - how far in from the left of its artboard a frame's
// body begins, in authored units, with every weapon layer left out.
//
// Geometry needs layout, so the frame is mounted out of sight for the one
// getBBox call and taken straight back down. Its stylesheet is dropped first:
// mounted inline it would apply to the whole page, and nothing in it moves any
// artwork. Anything that goes wrong answers 0, the artboard edge, which is
// where the body begins on every frame the weapon does not reach behind.
function _measureEnemyBodyBackX(root) {
    if (typeof document === 'undefined' || !document.body) return 0;
    const svg = document.importNode(root, true);
    for (const style of svg.querySelectorAll('style')) style.remove();
    for (const layer of _enemyWeaponLayers(svg)) layer.setAttribute('display', 'none');

    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
    host.appendChild(svg);
    let backX = 0;
    try {
        document.body.appendChild(host);
        const box = svg.getBBox();
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        if (box.width > 0) backX = box.x - (viewBox ? viewBox.x : 0);
    } catch (e) {
        // Keep the artboard edge.
    } finally {
        host.remove();
    }
    return backX;
}

const _enemyFrameAnchorCache = Object.create(null);

// _enemyFrameAnchor - whether one frame carries a weapon, and where its body's
// back edge sits. Frames recur across states (a wind-up shared by an attack and
// a taunt, say), so each file is looked at once.
function _enemyFrameAnchor(fileBase) {
    const path = _enemyAssetPath(fileBase);
    if (path in _enemyFrameAnchorCache) return _enemyFrameAnchorCache[path];
    const anchor = { armed: false, backX: 0 };
    const src = _enemyAssetSource(path);
    if (src.ok && typeof DOMParser === 'function') {
        const root = new DOMParser().parseFromString(src.text, 'image/svg+xml').documentElement;
        if (_enemyWeaponLayers(root).length) {
            anchor.armed = true;
            anchor.backX = _measureEnemyBodyBackX(root);
        }
    }
    _enemyFrameAnchorCache[path] = anchor;
    return anchor;
}

// _anchorEnemyWeaponStates - pin every frame of each armed animation by its
// back edge, stamped on the frame as anchorBackX for the renderer to find. The
// frames without a weapon in such a run, a wind-up or a recovery, are pinned
// too; they are what the armed frames have to line up with. Each state loads
// its own Images, so stamping one leaves the same file in any other state
// centred as before.
function _anchorEnemyWeaponStates(charDef, bases) {
    for (const [stateKey, fileBases] of Object.entries(bases)) {
        const anchors = fileBases.map(_enemyFrameAnchor);
        if (!anchors.some(anchor => anchor.armed)) continue;
        charDef.animations[stateKey].frames.forEach((img, i) => {
            img.anchorBackX = anchors[i].backX;
        });
    }
}

function _buildEnemyChar(enemyKey, defaults, typeDefaults, entry) {
    const merged = _mergeEnemyAssetEntry(defaults, typeDefaults, entry);
    if (merged.canGetUp) _deriveEnemyPowerAttack(enemyKey, merged);
    const charDef = {
        attackType: merged.attackType,
        canGetUp: merged.canGetUp,
        getUps: merged.getUps,
        attackTime: merged.attackTime,
        powerAttackEffect: merged.powerAttackEffect,
        // Layers are least specific first, so an enemy entry wins over the
        // attack-type block and that over the global defaults.
        appliedPlayerAnims: _buildEnemyAppliedPlayerAnims([defaults, typeDefaults, entry]),
        animations: {},
    };

    // Resolve every state to file bases first so the defeat sequence can be
    // checked against the collapse before any sprite is loaded.
    const bases = {};
    for (const stateKey of Object.keys(merged.animations)) {
        bases[stateKey] = _enemyAnimFileBases(enemyKey, stateKey, merged.animations);
    }
    _weaveEnemyPreDefeat(bases, merged.animations);

    for (const [stateKey, animDef] of Object.entries(merged.animations)) {
        charDef.animations[stateKey] = {
            mode: animDef.mode,
            fallbackState: animDef.fallbackState,
            frames: (bases[stateKey] || []).map(_loadEnemyFrame),
        };
    }
    if (merged.anchorWeapon) _anchorEnemyWeaponStates(charDef, bases);

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

// _enemyConfigEntries - every enemy the config builds, WIP stubs included.
function _enemyConfigEntries() {
    const wipEntries = {};
    for (const enemyKey of ENEMY_ASSET_CONFIG.wipEnemies || []) {
        wipEntries[enemyKey] = {};
    }
    return Object.assign({}, wipEntries, ENEMY_ASSET_CONFIG.enemies || {});
}

// ── Parallel warm-up ─────────────────────────────────────────────────────────
// Resolution cannot know what an animation is made of without first knowing
// which files exist, and the only way it can answer that is by fetching. Asked
// one file at a time over synchronous XHR, that was comfortably the slowest
// thing in the whole startup: around 300 blocking round trips with the main
// thread held for all of them, so the loading screen could not so much as
// repaint while it happened and the game looked hung rather than slow.
//
// The same files are now fetched in parallel rounds before the build runs,
// filling the very cache the synchronous path reads from. The build that
// follows is unchanged and issues no requests of its own.
//
// Nothing here is load-bearing. A path the warm-up does not reach, or a whole
// warm-up that fails because fetch is unavailable (opening the game straight
// off disk over file://, for one), just leaves the cache cold and the
// synchronous path picks it up exactly as it always did.

// _enemyWarmBases - every file base the config could ask about.
//
// Deliberately generous: it takes the suffixes as written across all three
// config layers without resolving them, so it covers literals, the states an
// assembled animation reaches through, and the stems of numbered runs alike. A
// base that turns out to name nothing costs one 404 in a batch that was going
// out anyway.
function _enemyWarmBases() {
    const bases = new Set();
    const defaults = ENEMY_ASSET_CONFIG.defaults || {};
    const attackTypeDefaults = ENEMY_ASSET_CONFIG.attackTypeDefaults || {};

    for (const [enemyKey, entry] of Object.entries(_enemyConfigEntries())) {
        const types = _enemyAttackTypes(entry.attackType || defaults.attackType);
        const typeDefaults = _mergeAttackTypeDefaults(attackTypeDefaults, types);
        bases.add(enemyKey);
        bases.add(`${enemyKey}_${ENEMY_POWER_ATTACK_SUFFIX}`);

        for (const layer of [defaults.animations, typeDefaults.animations, entry.animations]) {
            for (const [stateKey, animDef] of Object.entries(layer || {})) {
                if (_isEnemyEffectKey(stateKey) || !animDef || typeof animDef !== 'object') continue;
                for (const suffix of animDef.suffixes || []) {
                    bases.add(suffix ? `${enemyKey}_${suffix}` : enemyKey);
                }
                for (const fileBase of animDef.files || []) bases.add(fileBase);
            }
        }

        // The player animations this enemy's hits swap in are fetched from the
        // same pass; they resolve by the same literal-then-numbered-run rule.
        for (const layer of [defaults, typeDefaults, entry]) {
            for (const [key, value] of Object.entries(layer || {})) {
                const match = ENEMY_APPLY_RE.exec(key);
                if (match && typeof value === 'string' && value) bases.add(`Player_${match[1]}_${value}`);
            }
        }
    }
    return [...bases];
}

// _fetchEnemyAssets - pull a batch of paths into the cache at once.
//
// A path that cannot be read is recorded as absent, which is the same answer
// the synchronous probe would reach. A path that throws is left out of the
// cache entirely so the synchronous path still gets its turn at it.
function _fetchEnemyAssets(paths) {
    return Promise.all(paths.map(path => {
        if (path in _enemyAssetCache) return null;
        return fetch(path)
            .then(res => (res.ok ? res.text().then(text => ({ ok: true, text })) : { ok: false, text: '' }))
            .then(entry => { _enemyAssetCache[path] = entry; })
            .catch(() => {});
    }));
}

// _warmEnemyAssets - fetch everything the build is about to read.
//
// One round for the literal of every base, then a round per numbered index: all
// bases still on a run ask for "_0" together, whichever of those exist ask for
// "_1" together, and so on. That is the contiguous-run rule the synchronous
// resolver applies, turned inside out, so the whole set costs about as many
// round trips as the longest animation has frames instead of one per file.
async function _warmEnemyAssets() {
    if (typeof fetch !== 'function') return;
    const bases = _enemyWarmBases();
    await _fetchEnemyAssets(bases.map(_enemyAssetPath));

    // Nothing at all came back, so fetch is present but cannot serve these (a
    // file:// page, say). Stop rather than spend a round per frame index
    // finding that out again; the synchronous path still reads every file.
    if (!Object.keys(_enemyAssetCache).length) return;

    let running = bases.filter(fileBase => !_enemyAssetExists(_enemyAssetPath(fileBase)));
    for (let i = 0; i < ENEMY_RANGE_LIMIT && running.length; i++) {
        await _fetchEnemyAssets(running.map(fileBase => _enemyAssetPath(`${fileBase}_${i}`)));
        running = running.filter(fileBase => _enemyAssetExists(_enemyAssetPath(`${fileBase}_${i}`)));
    }
}

function _buildEnemyChars() {
    const built = {};
    const defaults = ENEMY_ASSET_CONFIG.defaults || {};
    const attackTypeDefaults = ENEMY_ASSET_CONFIG.attackTypeDefaults || {};
    for (const [enemyKey, entry] of Object.entries(_enemyConfigEntries())) {
        const types = _enemyAttackTypes(entry.attackType || defaults.attackType);
        built[enemyKey] = _buildEnemyChar(
            enemyKey, defaults, _mergeAttackTypeDefaults(attackTypeDefaults, types), entry
        );
    }
    return built;
}

// ENEMY_CHARS is filled in rather than assigned, so the reference every other
// module already holds stays valid. Nothing reads it before ASSETS_READY, which
// waits on ENEMY_CHARS_READY.
const ENEMY_CHARS = {};

const ENEMY_CHARS_READY = (async () => {
    try {
        await _warmEnemyAssets();
    } catch (e) {
        console.warn('[enemy-assets] Parallel warm-up failed, loading one file at a time', e);
    }
    Object.assign(ENEMY_CHARS, _buildEnemyChars());
    return ENEMY_CHARS;
})();

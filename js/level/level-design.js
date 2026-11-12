// js/level/level-design.js - when things happen in a level
//
// A level has two sources. The level SVG's layer names say where and what:
// the walkable field, the doors, what breaks, what animates (js/level/
// level-map.js). A level design file, config/levels/<level>/level-design.json,
// says when: it is a small state machine whose triggers are the events the
// level map already reports ("break:parking-gate-arm", "enter:bad-bar") and
// whose actions name layers by path rather than by coordinates.
//
//   { "version": 1, "start": "initial",
//     "cases":      { "gate-broken": false },
//     "restricted": { "corner-shop": { "until": "case:gate-broken" } },
//     "states": {
//       "initial":     { "next": [{ "on": "break:gate", "to": "gate-breaks" }] },
//       "gate-breaks": { "set": { "gate-broken": true } } } }
//
// config/schema/level-design.schema.json describes every key for editors; the
// words it allows are the ones in LEVEL_DESIGN_VOCAB below, which is what the
// validator reads, so the two are kept in step by a check rather than by hand.
//
// Nothing in this file knows about any one level. It reads kinds (enemy,
// player), layer paths, events and cases, and the level supplies the names.

// _levelDesignFreeze - freeze an object and everything in it, so the
// vocabulary cannot be changed by accident from somewhere that reads it.
function _levelDesignFreeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(_levelDesignFreeze);
        Object.freeze(value);
    }
    return value;
}

// ── Vocabulary ────────────────────────────────────────────────────────────────
// Every word a level design may use, in one place. The schema's enums, the
// validator and the docs' cheatsheet are all written from this table.
const LEVEL_DESIGN_VOCAB = _levelDesignFreeze({
    version: 1,

    // The keys each object may carry.
    keys: {
        top:        ['$schema', 'version', 'start', 'cases', 'restricted', 'states'],
        restricted: ['until'],
        state:      ['svg', 'set', 'player', 'spawn', 'animate-layers', 'characters', 'next'],
        player:     ['spawn', 'after', 'animation', 'inventory', 'health'],
        spawn:      ['group', 'type', 'count', 'pick', 'pool', 'from', 'animation', 'after', 'every'],
        animateLayer: ['layer', 'position-x', 'position-y', 'type', 'duration', 'after'],
        // A pool entry written as an object: an enemy drawn with a render.
        poolEntry:  ['enemy', 'render'],
        characters: ['friendly', 'neutral'],
        next:       ['on', 'to'],
    },

    // The values a key may take.
    values: {
        svg:         ['loads', 'layer-state-change', 'fade-out'],
        playerSpawn: ['left', 'right'],
        animation:   ['walk', 'idle'],
        inventory:   ['empty', 'inherit', 'store'],
        health:      ['full', 'inherit', 'store'],
        spawnType:   ['enemy'],
        pick:        ['random', 'in-order'],
        // How a moving layer travels: LEVEL_LAYER_EASES in
        // js/entities/level-objects.js has one of each.
        ease:        ['linear', 'ease-in', 'ease-out', 'ease-in-out'],
    },

    // What "on" and "until" can name, as "<kind>:<key>".
    //   map       reported by the level map's runtime (js/level/level-runtime.js)
    //   director  reported by the director: "spawn:<group>" and
    //             "defeated:<group>" for the groups it spawns, "arrive:<state>"
    //             when the player has finished coming on for that state
    //   condition true or false right now, not an event: "case:<name>" is that
    //             case being true, "state:<name>" is that state having been entered
    triggers: {
        map:       ['animate', 'break', 'enter', 'exit', 'interact', 'event', 'locked', 'unlock'],
        director:  ['spawn', 'defeated', 'arrive'],
        condition: ['case', 'state'],
    },

    // What the director reports on the level map's event bus, as "<kind>:<key>".
    // "unlock" is sent by the runtime when the director opens a RESTRICTED.
    reports: ['state', 'case', 'spawn', 'defeated', 'arrive', 'unlock'],
});

const LEVEL_DESIGN_TRIGGER_RE = /^([a-z]+):([A-Za-z0-9][A-Za-z0-9_-]*)$/;
const LEVEL_DESIGN_NAME_RE    = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// The shorthand a pool entry gets written in before the format is known:
// "JumpingJunkie:render([left-vest.background(gray), right-vest.background(gray)])",
// closing brackets optional, "fill(...)" as well as "background(...)".
// Parts are read from everything after "render(", so a missing bracket at the
// end never takes a part's own closing parenthesis with it.
const LEVEL_DESIGN_SHORTHAND_RE      = /^\s*([A-Za-z][\w-]*)\s*:\s*render\s*\(([\s\S]*)$/;
const LEVEL_DESIGN_SHORTHAND_PART_RE = /([A-Za-z][\w-]*)\s*\.\s*(?:background|fill)\s*\(\s*([A-Za-z0-9][\w-]*)\s*\)/g;

// levelDesignShorthandEnemy - a shorthand pool entry as the object version 1
// writes, { enemy, render }, or null when the text is not one.
function levelDesignShorthandEnemy(text) {
    const match = LEVEL_DESIGN_SHORTHAND_RE.exec(String(text ?? ''));
    if (!match) return null;
    const render = {};
    for (const [, part, palette] of match[2].matchAll(LEVEL_DESIGN_SHORTHAND_PART_RE)) render[part] = palette;
    return Object.keys(render).length ? { enemy: match[1], render } : null;
}

// How many times the level may move from state to state in one frame. States
// that move on from each other's cases at once would otherwise loop for ever.
const LEVEL_DESIGN_MAX_STEPS = 16;

function _levelDesignIsObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

// levelDesignTrigger - "<kind>:<key>" as { kind, key, text }, or null.
function levelDesignTrigger(text) {
    const match = LEVEL_DESIGN_TRIGGER_RE.exec(String(text ?? '').trim());
    return match ? { kind: match[1], key: match[2], text: `${match[1]}:${match[2]}` } : null;
}

function _levelDesignTriggerKinds() {
    const { map, director, condition } = LEVEL_DESIGN_VOCAB.triggers;
    return [...map, ...director, ...condition];
}

// ── Suggestions ───────────────────────────────────────────────────────────────
// A misspelt name in a level design is a door that never opens or a state
// that is never reached, so every warning about a name offers the nearest
// real one when there is one close enough to be the likely meaning.

// _levelDesignDistance - edits between two words, counting a swap of two
// neighbouring letters as one ("spwan" is one edit from "spawn").
function _levelDesignDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }
    return d[a.length][b.length];
}

// levelDesignClosest - the option nearest to word, or null when none is near
// enough: within a third of the word's length (at least 2 edits), or one
// containing the other ("parking-gate" for "parking-gate-arm").
function levelDesignClosest(word, options) {
    const text = String(word ?? '');
    if (!text) return null;
    let best = null;
    let bestScore = Infinity;
    for (const option of options) {
        if (option === text) return option;
        const contains = text.length >= 4 && option.length >= 4
            && (option.includes(text) || text.includes(option));
        const score = contains ? Math.abs(option.length - text.length) * 0.5 : _levelDesignDistance(text, option);
        const limit = Math.max(2, Math.floor(text.length / 3));
        if ((contains || score <= limit) && score < bestScore) {
            best = option;
            bestScore = score;
        }
    }
    return best;
}

function _levelDesignDidYouMean(word, options) {
    const close = levelDesignClosest(word, options);
    return close ? `; did you mean "${close}"?` : '';
}

function _levelDesignWords(id) {
    return String(id).toLowerCase().split(/[-_]+/).filter(Boolean);
}

// levelDesignSuggestPath - the layer path in map most likely meant by one
// that names nothing, or null. The last part has to name a real layer (an
// exact id or a near miss); its parent is then the mapped parent, of the same
// prefix, that shares the most words with the one written, so
// "RESTRICTED-building-warehouse/ENTER-building" finds
// "RESTRICTED-import-export-warehouse/ENTER-building" by "warehouse".
function levelDesignSuggestPath(map, path) {
    if (!map || typeof levelMapFindAll !== 'function') return null;
    const parts = String(path || '').split('/').map(part => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    let last = parts[parts.length - 1];
    let candidates = levelMapFindAll(map, last).filter(region => region.world);
    if (!candidates.length) {
        const close = levelDesignClosest(last, map.regions.filter(region => region.world).map(region => region.id));
        if (!close) return null;
        last = close.replace(/-\d+$/, '');
        candidates = levelMapFindAll(map, last).filter(region => region.world);
    }
    if (parts.length === 1) return candidates.length ? last : null;

    const wanted = parts[parts.length - 2];
    const prefix = _levelDesignWords(wanted)[0];
    const wantedWords = new Set(_levelDesignWords(wanted).slice(1));
    let best = null;
    let bestOverlap = 0;
    for (const region of candidates) {
        if (!region.parent) continue;
        const words = _levelDesignWords(region.parent);
        if (words[0] !== prefix) continue;
        const overlap = words.slice(1).filter(word => wantedWords.has(word)).length;
        if (overlap > bestOverlap) {
            best = region.parent;
            bestOverlap = overlap;
        }
    }
    return best ? `${best}/${last}` : null;
}

// levelDesignSeconds - a time as seconds: a number, or text such as "2
// seconds", "1.5s" or "500ms", the way drafts tend to write it. Null when it
// is neither.
function levelDesignSeconds(value) {
    if (typeof value === 'number') return value >= 0 ? value : null;
    const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?)?\s*$/i.exec(String(value ?? ''));
    if (!match) return null;
    const amount = parseFloat(match[1]);
    return /^m/i.test(match[2] || '') ? amount / 1000 : amount;
}

// ── Loading ───────────────────────────────────────────────────────────────────
// _levelDesignReadText - a file's text, or the reason there is none. The same
// synchronous read config/debug/sandbox.json gets, with the cache told to
// check back so an edit shows up on the next RESTART.
function _levelDesignReadText(path) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.send();
        // Status 0 with a body is the only "found" there is over file://.
        const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && !!xhr.responseText);
        return ok ? { text: xhr.responseText } : { problem: `${path} could not be read (status ${xhr.status})` };
    } catch (e) {
        return { problem: `${path} could not be read` };
    }
}

// loadLevelDesign - the parsed design and what is wrong with it, as
// { design, warnings }. design is null when there is nothing to run. Never
// throws: a level whose design cannot be read still plays, without it.
function loadLevelDesign(path) {
    const read = _levelDesignReadText(path);
    if (read.problem) return { design: null, warnings: [read.problem] };
    let design;
    try {
        design = JSON.parse(read.text);
    } catch (e) {
        return { design: null, warnings: [`${path} is not valid JSON (${e.message})`] };
    }
    if (!_levelDesignIsObject(design)) return { design: null, warnings: [`${path} is not a JSON object`] };
    return { design, warnings: [] };
}

// ── Validation ────────────────────────────────────────────────────────────────
// _levelDesignMapNames - the names a map event can carry for each kind, from
// the level map. Null when there is no map, which skips those checks.
function _levelDesignMapNames(map) {
    if (!map) return null;
    const enterables = map.enterables.map(entry => entry.name);
    const loose = map.hotspots.filter(spot => !spot.enterable).map(spot => spot.id);
    const restricted = map.enterables.filter(entry => entry.restricted).map(entry => entry.name);
    return {
        // A moving layer reports animate:<name> too, once it is where it was sent.
        animate:  new Set([...map.animations.map(entry => entry.assetName),
                           ...(map.layers || []).map(entry => entry.name)]),
        break:    new Set(map.breakables.map(entry => entry.name)),
        enter:    new Set([...enterables, ...loose]),
        exit:     new Set(enterables),
        interact: new Set(map.objects.map(entry => entry.name)),
        event:    new Set(map.events.map(entry => entry.name)),
        locked:   new Set(restricted),
        unlock:   new Set(restricted),
    };
}

// What a map kind names, for a warning that says what was looked for.
const LEVEL_DESIGN_MAP_KIND_LABEL = {
    animate: 'ANIMATE-', break: 'BREAKABLE-', enter: 'ENTERABLE- or RESTRICTED-',
    exit: 'ENTERABLE- or RESTRICTED-', interact: 'OBJECT-', event: 'EVENT-',
    locked: 'RESTRICTED-', unlock: 'RESTRICTED-',
};

// validateLevelDesign - what in a design will not work as written, as a list
// of sentences. map is the level map of the scene the design runs on; without
// one, the checks against the SVG are skipped. Never throws.
function validateLevelDesign(design, map = null) {
    const warnings = [];
    const warn = text => warnings.push(text);
    if (!_levelDesignIsObject(design)) {
        warn('the level design is not a JSON object');
        return warnings;
    }
    const V = LEVEL_DESIGN_VOCAB;
    const unknownKeys = (obj, allowed, where) => {
        for (const key of Object.keys(obj)) {
            if (!allowed.includes(key)) {
                warn(`${where}: "${key}" is not a level design key${_levelDesignDidYouMean(key, allowed)}`);
            }
        }
    };
    const oneOf = (value, allowed, where) => {
        if (value !== undefined && !allowed.includes(value)) {
            const close = levelDesignClosest(value, allowed);
            warn(`${where} is "${value}"; ${close ? `did you mean "${close}"? ` : ''}use one of ${allowed.join(', ')}`);
        }
    };
    const seconds = (value, where) => {
        if (value !== undefined && !(typeof value === 'number' && value >= 0)) {
            const read = levelDesignSeconds(value);
            warn(`${where} should be a number of seconds, such as ${read !== null ? read : 2}`);
        }
    };
    const layerPath = (path, where) => {
        if (map && typeof levelMapFind === 'function' && !levelMapFind(map, path)) {
            const close = levelDesignSuggestPath(map, path);
            warn(`${where} names "${path}", which is not a layer in the level SVG`
               + (close ? `; did you mean "${close}"?` : ''));
        }
    };
    // A pool entry: an enemy's id or art name, or { "enemy", "render" }. The
    // render's palettes are checked against config/palettes.json and its parts
    // against the enemy's base frame, the way a render will look for them.
    // Without the game's tables (a check run outside the browser) only the
    // shape is checked.
    const enemyNames = typeof ENEMY_DEFS === 'undefined' ? null : Object.keys(ENEMY_DEFS)
        .filter(id => !ENEMY_DEFS[id].variantOf)
        .flatMap(id => [id, ENEMY_DEFS[id].img]);
    const enemyName = (name, where) => {
        if (!enemyNames || typeof enemyDefId !== 'function') return null;
        const id = enemyDefId(name);
        if (!id) warn(`${where} names "${name}", which is not an enemy${_levelDesignDidYouMean(name, enemyNames)}`);
        return id;
    };
    const poolEntry = (entry, where) => {
        if (typeof entry === 'string') {
            const read = levelDesignShorthandEnemy(entry);
            if (read) warn(`${where} is "${entry}"; write it as ${JSON.stringify(read)}`);
            else enemyName(entry, where);
            return;
        }
        if (!_levelDesignIsObject(entry)) {
            warn(`${where} should be an enemy's name, or { "enemy": ..., "render": { ... } }`);
            return;
        }
        unknownKeys(entry, V.keys.poolEntry, where);
        if (typeof entry.enemy !== 'string' || !entry.enemy.trim()) {
            warn(`${where} needs "enemy", the enemy to draw`);
            return;
        }
        const id = enemyName(entry.enemy, `${where} "enemy"`);
        if (entry.render === undefined) return;
        if (!_levelDesignIsObject(entry.render)) {
            warn(`${where} "render" should be an object of part names and palettes, such as { "left-vest": "gray" }`);
            return;
        }
        const palettes = typeof VARIANT_PALETTES !== 'undefined' ? VARIANT_PALETTES.palettes : null;
        const baseImg = id ? ENEMY_DEFS[ENEMY_DEFS[id].variantOf || id].img : null;
        const art = baseImg && typeof enemyArtFile === 'function' ? enemyArtFile(baseImg) : null;
        const parts = art && typeof variantArtParts === 'function' ? variantArtParts(art.path, art.text) : null;
        for (const [part, value] of Object.entries(entry.render)) {
            const at = `${where} "render" "${part}"`;
            if (typeof value !== 'string') {
                warn(`${at} is ${JSON.stringify(value)}; only a palette name, such as "gray", is built`);
            } else if (palettes && !palettes[value]) {
                warn(`${at} names palette "${value}", which is not in config/palettes.json`
                   + _levelDesignDidYouMean(value, Object.keys(palettes)));
            }
            if (parts && !parts.find(part)) {
                warn(`${at}: ${art.path.split('/').pop()} has no layer named "${part}"`
                   + _levelDesignDidYouMean(part, parts.names));
            }
        }
    };
    // A moving layer is any layer of the art, found when the scene was built
    // with it (levelDesignLayerMoves), so the map says what happened to it.
    const movingLayer = (path, where) => {
        if (!map || typeof levelMapLayerPath !== 'function') return;
        const wanted = levelMapLayerPath(path);
        const last = wanted.split('/').pop();
        const asked = (map.layerRequests || []).find(request => request.path === wanted);
        const ids = map.ids || [];
        const inArt = !ids.length || ids.includes(last) || ids.includes(last.replace(/-\d+$/, ''));
        if (asked?.problem === 'missing' || !inArt) {
            warn(`${where} names "${path}", which is not a layer in the level SVG`
               + _levelDesignDidYouMean(last, ids));
        } else if (!asked) {
            warn(`${where}: the scene was built without "${path}", so it cannot move; `
               + 'RESTART builds the scene again with it');
        } else if (asked.problem) {
            warn(`${where} names "${path}", which cannot move: ${asked.problem}`);
        } else if (asked.matches > 1) {
            warn(`${where}: ${asked.matches} layers are named "${path}" and only the first moves; `
               + `name a layer it is inside as well, as "<parent>/${last}"`);
        }
    };

    unknownKeys(design, V.keys.top, 'the file');
    if (design.version !== V.version) {
        warn(`"version" is ${JSON.stringify(design.version)}; this game reads version ${V.version}, `
           + `and the file is read as that`);
    }

    const states = _levelDesignIsObject(design.states) ? design.states : {};
    const stateNames = Object.keys(states);
    if (!stateNames.length) warn('"states" lists no states, so the design does nothing');
    if (!stateNames.includes(design.start)) {
        warn(`"start" is "${design.start}", which is not one of the states (${stateNames.join(', ') || 'none'})`
           + _levelDesignDidYouMean(design.start, stateNames));
    }

    const cases = _levelDesignIsObject(design.cases) ? design.cases : {};
    if (design.cases !== undefined && !_levelDesignIsObject(design.cases)) {
        warn('"cases" should be an object of names and true or false');
    }
    for (const [name, value] of Object.entries(cases)) {
        if (typeof value !== 'boolean') warn(`case "${name}" should be true or false`);
    }

    const groups = new Set();
    for (const state of Object.values(states)) {
        for (const group of Array.isArray(state?.spawn) ? state.spawn : []) {
            if (typeof group?.group === 'string') groups.add(group.group);
        }
    }

    const mapNames = _levelDesignMapNames(map);
    const trigger = (text, where) => {
        const parsed = levelDesignTrigger(text);
        if (!parsed) {
            warn(`${where} is "${text}"; write a trigger as <kind>:<name>, such as "break:crate-stack"`);
            return;
        }
        const { kind, key } = parsed;
        if (!_levelDesignTriggerKinds().includes(kind)) {
            warn(`${where}: "${kind}" is not a trigger kind${_levelDesignDidYouMean(kind, _levelDesignTriggerKinds())} `
               + `Use one of ${_levelDesignTriggerKinds().join(', ')}`);
        } else if (kind === 'case' && !(key in cases)) {
            warn(`${where} waits on case "${key}", which is not in "cases"${_levelDesignDidYouMean(key, Object.keys(cases))}`);
        } else if (kind === 'state' && !stateNames.includes(key)) {
            warn(`${where} waits on state "${key}", which is not in "states"${_levelDesignDidYouMean(key, stateNames)}`);
        } else if (kind === 'arrive') {
            if (!stateNames.includes(key)) {
                warn(`${where} waits on the player arriving for state "${key}", which is not in "states"`
                   + _levelDesignDidYouMean(key, stateNames));
            } else if (states[key]?.player?.spawn === undefined) {
                warn(`${where} waits on "arrive:${key}", but state "${key}" has no "player" "spawn", so the player never arrives`);
            }
        } else if ((kind === 'spawn' || kind === 'defeated') && !groups.has(key)) {
            warn(`${where} waits on group "${key}", which no state spawns${_levelDesignDidYouMean(key, [...groups])}`);
        } else if (mapNames?.[kind] && !mapNames[kind].has(key)) {
            // The level SVG is the only scene known before play; an interior's
            // own layers are read when its door is first used.
            const close = levelDesignClosest(key, [...mapNames[kind]]);
            warn(`${where} waits on "${kind}:${key}", but the level SVG has no `
               + `${LEVEL_DESIGN_MAP_KIND_LABEL[kind]}${key}`
               + (close ? `; did you mean "${kind}:${close}"?` : ' (ignore this if it is inside an interior)'));
        }
    };

    // Restricted
    if (design.restricted !== undefined && !_levelDesignIsObject(design.restricted)) {
        warn('"restricted" should be an object keyed by RESTRICTED- layer name');
    }
    for (const [name, entry] of Object.entries(_levelDesignIsObject(design.restricted) ? design.restricted : {})) {
        const where = `restricted "${name}"`;
        if (!_levelDesignIsObject(entry)) {
            warn(`${where} should be an object with "until"`);
            continue;
        }
        unknownKeys(entry, V.keys.restricted, where);
        if (entry.until === undefined) warn(`${where} has no "until", so it stays locked`);
        else trigger(entry.until, `${where} "until"`);
        if (mapNames && !mapNames.locked.has(name)) {
            warn(`${where}: the level SVG has no RESTRICTED-${name}`);
        }
    }

    // States
    const seenGroups = new Set();
    for (const [name, state] of Object.entries(states)) {
        const where = `state "${name}"`;
        if (!LEVEL_DESIGN_NAME_RE.test(name)) warn(`${where}: use letters, digits, - and _ in a state name`);
        if (!_levelDesignIsObject(state)) {
            warn(`${where} should be an object`);
            continue;
        }
        unknownKeys(state, V.keys.state, where);
        oneOf(state.svg, V.values.svg, `${where} "svg"`);

        if (state.set !== undefined) {
            if (!_levelDesignIsObject(state.set)) {
                warn(`${where} "set" should be an object of case names and true or false`);
            } else {
                for (const [caseName, value] of Object.entries(state.set)) {
                    if (!(caseName in cases)) {
                        warn(`${where} sets case "${caseName}", which is not in "cases"`
                           + _levelDesignDidYouMean(caseName, Object.keys(cases)));
                    }
                    if (typeof value !== 'boolean') warn(`${where} sets case "${caseName}" to something other than true or false`);
                }
            }
        }

        if (state.player !== undefined) {
            const player = state.player;
            const at = `${where} "player"`;
            if (!_levelDesignIsObject(player)) {
                warn(`${at} should be an object`);
            } else {
                unknownKeys(player, V.keys.player, at);
                if (player.spawn !== undefined && !V.values.playerSpawn.includes(player.spawn)) {
                    if (typeof player.spawn !== 'string') warn(`${at} "spawn" should be left, right or a layer path`);
                    else layerPath(player.spawn, `${at} "spawn"`);
                }
                seconds(player.after, `${at} "after"`);
                oneOf(player.animation, V.values.animation, `${at} "animation"`);
                oneOf(player.inventory, V.values.inventory, `${at} "inventory"`);
                oneOf(player.health, V.values.health, `${at} "health"`);
            }
        }

        if (state.spawn !== undefined && !Array.isArray(state.spawn)) {
            warn(`${where} "spawn" should be a list of groups`);
        }
        for (const [i, group] of (Array.isArray(state.spawn) ? state.spawn : []).entries()) {
            const at = `${where} spawn ${typeof group?.group === 'string' ? `"${group.group}"` : `#${i + 1}`}`;
            if (!_levelDesignIsObject(group)) {
                warn(`${at} should be an object`);
                continue;
            }
            unknownKeys(group, V.keys.spawn, at);
            if (typeof group.group !== 'string' || !LEVEL_DESIGN_NAME_RE.test(group.group)) {
                warn(`${at} needs a "group" name, used to report spawn:<group> and defeated:<group>`);
            } else if (seenGroups.has(group.group)) {
                warn(`${at}: another spawn is also named "${group.group}", so their reports cannot be told apart`);
            } else {
                seenGroups.add(group.group);
            }
            if (group.type === undefined) warn(`${at} needs a "type"`);
            oneOf(group.type, V.values.spawnType, `${at} "type"`);
            if (group.count !== undefined && !(Number.isInteger(group.count) && group.count >= 1)) {
                warn(`${at} "count" should be a whole number, 1 or more`);
            }
            if (Array.isArray(group.pick)) {
                warn(`${at} "pick" lists enemies; list them in "pool", and write "pick": "random" or "in-order"`);
                if (group.pool === undefined) group.pick.forEach((entry, n) => poolEntry(entry, `${at} "pick" #${n + 1}`));
            } else {
                oneOf(group.pick, V.values.pick, `${at} "pick"`);
            }
            if (group.pool !== undefined) {
                if (!Array.isArray(group.pool) || !group.pool.length) {
                    warn(`${at} "pool" should be a list of enemies`);
                } else {
                    group.pool.forEach((entry, n) => poolEntry(entry, `${at} "pool" #${n + 1}`));
                }
            }
            if (typeof group.from !== 'string') warn(`${at} needs "from", the layer they come out of`);
            else layerPath(group.from, `${at} "from"`);
            oneOf(group.animation, V.values.animation, `${at} "animation"`);
            seconds(group.after, `${at} "after"`);
            seconds(group.every, `${at} "every"`);
        }

        const moves = state['animate-layers'];
        if (moves !== undefined && !Array.isArray(moves)) {
            warn(`${where} "animate-layers" should be a list of layers to move`);
        }
        for (const [i, move] of (Array.isArray(moves) ? moves : []).entries()) {
            const at = `${where} animate-layers ${typeof move?.layer === 'string' ? `"${move.layer}"` : `#${i + 1}`}`;
            if (!_levelDesignIsObject(move)) {
                warn(`${at} should be an object`);
                continue;
            }
            unknownKeys(move, V.keys.animateLayer, at);
            if (typeof move.layer !== 'string' || !move.layer.trim()) warn(`${at} needs "layer", the layer to move`);
            else movingLayer(move.layer, `${at} "layer"`);
            for (const axis of ['position-x', 'position-y']) {
                if (move[axis] !== undefined && !Number.isFinite(move[axis])) {
                    warn(`${at} "${axis}" should be a number, in the level SVG's units`);
                }
            }
            if (move['position-x'] === undefined && move['position-y'] === undefined) {
                warn(`${at} has no "position-x" or "position-y", so it does not move`);
            }
            oneOf(move.type, V.values.ease, `${at} "type"`);
            seconds(move.duration, `${at} "duration"`);
            seconds(move.after, `${at} "after"`);
        }

        if (state.characters !== undefined) {
            if (!_levelDesignIsObject(state.characters)) {
                warn(`${where} "characters" should be an object`);
            } else {
                unknownKeys(state.characters, V.keys.characters, `${where} "characters"`);
                for (const kind of V.keys.characters) {
                    if (state.characters[kind] !== undefined && state.characters[kind] !== false) {
                        warn(`${where}: ${kind} characters are planned, not built yet`);
                    }
                }
            }
        }

        if (state.next !== undefined && !Array.isArray(state.next)) {
            warn(`${where} "next" should be a list of { "on", "to" }`);
        }
        for (const [i, step] of (Array.isArray(state.next) ? state.next : []).entries()) {
            const at = `${where} next #${i + 1}`;
            if (!_levelDesignIsObject(step)) {
                warn(`${at} should be { "on": ..., "to": ... }`);
                continue;
            }
            unknownKeys(step, V.keys.next, at);
            if (step.on === undefined) warn(`${at} has no "on", so it never fires`);
            else trigger(step.on, `${at} "on"`);
            if (!stateNames.includes(step.to)) {
                warn(`${at} goes to "${step.to}", which is not in "states"${_levelDesignDidYouMean(step.to, stateNames)}`);
            }
        }
    }

    // A state nothing leads to is usually a misspelt "to".
    if (stateNames.includes(design.start)) {
        const reached = new Set([design.start]);
        const queue = [design.start];
        while (queue.length) {
            const steps = states[queue.shift()]?.next;
            for (const step of Array.isArray(steps) ? steps : []) {
                if (stateNames.includes(step?.to) && !reached.has(step.to)) {
                    reached.add(step.to);
                    queue.push(step.to);
                }
            }
        }
        for (const name of stateNames) {
            if (!reached.has(name)) warn(`state "${name}" is never reached from "${design.start}"`);
        }
    }
    return warnings;
}

// ── Drafts ────────────────────────────────────────────────────────────────────
// A file with no "version" is a draft: the shape a level design takes when it
// is written down before the format is known. It is converted to version 1 in
// memory, with a note for every change, and never rewritten on disk; the
// sandbox prints the converted file so it can be saved over the draft.
//
//   draft                                   version 1
//   "states": ["a", "b"], "a": {...}        "start": "a", "states": { "a": {...}, ... }
//   "case": ["x"] + the first state's        "cases": { "x": <its starting value> }
//     "set-case"
//   "set-case"                              "set"
//   "characters": { "player": {...} }       "player": { "spawn", "after", "animation", ... }
//     "spaw(n)-position", "spawn(s)-after",
//     "spawn-animation", "2 seconds"
//   "characters": { "enemy": {...} }        "spawn": [{ "group": "<state>-enemies", ... }]
//     "assets": "random", "a, b" positions  "pick": "random", "from": "a/b"
//   "events": { "breakable-x": "break:met" } on state b
//                                           "next": [{ "on": "break:x", "to": "b" }] on the
//                                           state before b
//   a later state nothing leads to, after   "next": [{ "on": "defeated:<group>" }] on the
//     a state that spawns enemies           state before it

// Draft spellings for each player and enemy key, the v1 key first.
const LEVEL_DESIGN_DRAFT_ALIASES = {
    spawn:     ['spawn', 'spawn-position', 'spaw-position', 'spawn_position', 'position'],
    after:     ['after', 'spawns-after', 'spawn-after', 'spawn_after', 'spawns_after'],
    animation: ['animation', 'spawn-animation', 'spawn_animation'],
};

// A draft's event key, "<layer prefix>-<name>", as the event kind it reports.
const LEVEL_DESIGN_DRAFT_EVENT_KIND = {
    breakable: 'break', animate: 'animate', enterable: 'enter', restricted: 'enter',
    enter: 'enter', object: 'interact', event: 'event',
};

// migrateLevelDesign - a draft as version 1, and what was changed to get
// there, as { design, warnings }. map, when given, is used to correct layer
// paths that name nothing to the nearest real one (and say so).
function migrateLevelDesign(draft, map = null) {
    const warnings = [];
    const note = text => warnings.push(text);
    const noted = new Set();
    const noteOnce = (key, text) => {
        if (!noted.has(key)) {
            noted.add(key);
            note(text);
        }
    };
    note('the file has no "version", so it is read as a draft and converted; '
       + 'the console shows it as version 1, ready to save over the draft');

    // The states, in order, and where each one's object is.
    const stateSource = _levelDesignIsObject(draft.states) ? draft.states : draft;
    const order = Array.isArray(draft.states)
        ? draft.states.filter(name => typeof name === 'string' && _levelDesignIsObject(draft[name]))
        : Object.keys(stateSource).filter(name =>
            _levelDesignIsObject(stateSource[name]) && !LEVEL_DESIGN_VOCAB.keys.top.includes(name));
    if (Array.isArray(draft.states)) {
        note('"states" is a list of names, with each state beside it; version 1 keeps each state '
           + 'under "states", keyed by its name, and starts at "start"');
        const missing = draft.states.filter(name => !order.includes(name));
        if (missing.length) note(`"states" lists ${missing.join(', ')}, with nothing written for them`);
    }
    const design = { version: 1, start: order[0], cases: {}, states: {} };

    // Cases, with their starting values from the first state.
    const caseNames = Array.isArray(draft.case) ? draft.case
                    : Array.isArray(draft.cases) ? draft.cases
                    : _levelDesignIsObject(draft.cases) ? Object.keys(draft.cases) : [];
    const firstSet = stateSource[order[0]]?.['set-case'] || stateSource[order[0]]?.set || {};
    for (const name of caseNames.filter(name => typeof name === 'string')) {
        design.cases[name] = _levelDesignIsObject(draft.cases) && typeof draft.cases[name] === 'boolean'
            ? draft.cases[name] : firstSet[name] === true;
    }
    if (Array.isArray(draft.case) || Array.isArray(draft.cases)) {
        note(`"case" is "cases" in version 1, with each case's starting value, `
           + `taken here from "${order[0]}"'s "set-case"`);
    }
    if (_levelDesignIsObject(draft.restricted)) design.restricted = draft.restricted;

    const pick = (src, key) => {
        for (const alias of LEVEL_DESIGN_DRAFT_ALIASES[key]) {
            if (src[alias] !== undefined) return { value: src[alias], alias };
        }
        return null;
    };
    const seconds = (found, where) => {
        const value = levelDesignSeconds(found.value);
        if (value !== null && typeof found.value !== 'number') {
            noteOnce(`seconds:${found.value}`, `${where} "${found.alias}": "${found.value}" is written "after": ${value}`);
        }
        return value;
    };
    const renamed = (found, to, where) => {
        if (found.alias !== to) noteOnce(`${found.alias}->${to}`, `${where}: "${found.alias}" is "${to}" in version 1`);
    };
    const layerPath = (text, where) => {
        let path = String(text).split(',').map(part => part.trim()).filter(Boolean).join('/');
        if (path !== text) note(`${where}: "${text}" is written as the path "${path}"`);
        if (map && typeof levelMapFind === 'function' && !levelMapFind(map, path)) {
            const close = levelDesignSuggestPath(map, path);
            if (close) {
                note(`${where}: "${path}" is not a layer in the level SVG; using "${close}", the closest match`);
                path = close;
            }
        }
        return path;
    };

    for (const [index, name] of order.entries()) {
        const src = stateSource[name];
        const where = `state "${name}"`;
        const state = {};
        if (src.svg !== undefined) state.svg = src.svg;

        const set = src['set-case'] ?? src.set;
        if (_levelDesignIsObject(set)) {
            state.set = { ...set };
            for (const caseName of Object.keys(set)) {
                if (!(caseName in design.cases)) {
                    design.cases[caseName] = false;
                    note(`${where} sets case "${caseName}", which "case" does not list; it is added, starting false`);
                }
            }
            if (src['set-case'] !== undefined) noteOnce('set-case', '"set-case" is "set" in version 1');
        }

        // Player
        const characters = _levelDesignIsObject(src.characters) ? src.characters : {};
        const playerSrc = _levelDesignIsObject(characters.player) ? characters.player
                        : _levelDesignIsObject(src.player) ? src.player : null;
        if (playerSrc) {
            if (characters.player) noteOnce('characters.player', '"characters": { "player" } is "player" in version 1');
            const player = {};
            const spawn = pick(playerSrc, 'spawn');
            if (spawn) {
                renamed(spawn, 'spawn', `${where} player`);
                player.spawn = ['left', 'right'].includes(spawn.value)
                    ? spawn.value : layerPath(spawn.value, `${where} player "spawn"`);
            }
            const after = pick(playerSrc, 'after');
            if (after) {
                renamed(after, 'after', `${where} player`);
                const value = seconds(after, `${where} player`);
                if (value !== null) player.after = value;
            }
            const animation = pick(playerSrc, 'animation');
            if (animation) {
                renamed(animation, 'animation', `${where} player`);
                player.animation = animation.value;
            }
            if (playerSrc.inventory !== undefined) player.inventory = playerSrc.inventory;
            if (playerSrc.health !== undefined) player.health = playerSrc.health;
            if (playerSrc.spawned !== undefined) {
                noteOnce('spawned', '"spawned" is not needed: a player given a "spawn" comes on, '
                                  + 'and one without stays where they are');
            }
            if (Object.keys(player).length) state.player = player;
        }

        // Enemies
        if (_levelDesignIsObject(characters.enemy)) {
            const enemySrc = characters.enemy;
            const group = { group: `${name}-enemies`, type: 'enemy' };
            note(`${where}: "characters": { "enemy" } is a spawn group, named "${group.group}"`);
            if (Number.isInteger(enemySrc.count)) group.count = enemySrc.count;
            if (enemySrc.assets === 'random' || enemySrc.pick !== undefined) {
                group.pick = enemySrc.pick ?? 'random';
                if (enemySrc.assets !== undefined) noteOnce('assets', '"assets": "random" is "pick": "random" in version 1');
            }
            if (Array.isArray(enemySrc.assets)) group.pool = enemySrc.assets;
            if (Array.isArray(enemySrc.pool)) group.pool = enemySrc.pool;
            const from = pick(enemySrc, 'spawn');
            if (from) {
                renamed(from, 'from', `${where} enemy`);
                group.from = layerPath(from.value, `${where} enemy "from"`);
            }
            const animation = pick(enemySrc, 'animation');
            if (animation) group.animation = animation.value;
            const after = pick(enemySrc, 'after');
            if (after) {
                const value = levelDesignSeconds(after.value);
                if (value !== null) {
                    group.after = value;
                } else {
                    note(`${where} enemy "${after.alias}": "${after.value}" is read as "when the state starts", `
                       + 'which is when a state\'s spawn groups begin');
                }
            }
            if (enemySrc.every !== undefined) group.every = enemySrc.every;
            if (enemySrc.spawned !== undefined) noteOnce('spawned-enemy', '"spawned" is not needed for enemies either');
            state.spawn = [group];
        }
        const others = {};
        for (const kind of ['friendly', 'neutral']) {
            if (characters[kind] !== undefined && characters[kind] !== false) others[kind] = characters[kind];
        }
        if (Object.keys(others).length) state.characters = others;
        if (Array.isArray(src.next)) state.next = [...src.next];
        if (Array.isArray(src.spawn)) state.spawn = src.spawn;
        if (Array.isArray(state.spawn)) {
            state.spawn = state.spawn.map((group, i) => _levelDesignDraftPool(group,
                `${where} spawn ${typeof group?.group === 'string' ? `"${group.group}"` : `#${i + 1}`}`, note));
        }
        if (Array.isArray(src['animate-layers'])) {
            state['animate-layers'] = src['animate-layers'].map(move => {
                if (!_levelDesignIsObject(move)) return move;
                const out = { ...move };
                for (const key of ['duration', 'after']) {
                    const value = typeof out[key] === 'string' ? levelDesignSeconds(out[key]) : null;
                    if (value === null) continue;
                    noteOnce(`seconds:${out[key]}`, `${where} animate-layers "${key}": "${out[key]}" is written ${value}`);
                    out[key] = value;
                }
                return out;
            });
        }

        // "events" on a state says what leads into it: a "next" on the one before.
        if (_levelDesignIsObject(src.events) && index > 0) {
            const before = design.states[order[index - 1]];
            for (const [key, value] of Object.entries(src.events)) {
                const on = _levelDesignDraftTrigger(key, value);
                if (!on) {
                    note(`${where} "events": "${key}": "${value}" could not be read as a trigger; `
                       + 'write it as "next": [{ "on": "<kind>:<name>", ... }] on the state before');
                    continue;
                }
                (before.next ||= []).push({ on, to: name });
                note(`${where} "events" says what leads into it; version 1 writes that on "${order[index - 1]}" `
                   + `as "next": [{ "on": "${on}", "to": "${name}" }]`);
            }
        }
        design.states[name] = state;
    }

    // A later state nothing leads to: after a state that spawns enemies, the
    // likely meaning is "once they are beaten".
    for (const [index, name] of order.entries()) {
        if (index === 0) continue;
        const reached = Object.values(design.states).some(state =>
            (state.next || []).some(step => step.to === name));
        if (reached) continue;
        const before = design.states[order[index - 1]];
        const group = (before.spawn || []).map(spec => spec.group).filter(Boolean).pop();
        if (group) {
            (before.next ||= []).push({ on: `defeated:${group}`, to: name });
            note(`state "${name}" has nothing leading to it; it follows "${order[index - 1]}", which spawns `
               + `"${group}", so it is read as "next": [{ "on": "defeated:${group}", "to": "${name}" }]`);
        }
    }
    return { design, warnings };
}

// _levelDesignDraftPool - a draft spawn group's enemies as version 1 lists
// them: a "pick" that lists enemies becomes the "pool" (when there is none)
// with "pick": "random", and each shorthand entry,
// "Name:render([part.background(palette), ...])", becomes { enemy, render }.
function _levelDesignDraftPool(group, where, note) {
    if (!_levelDesignIsObject(group)) return group;
    const out = { ...group };
    if (Array.isArray(out.pick)) {
        if (!Array.isArray(out.pool)) out.pool = out.pick;
        note(`${where}: "pick" lists enemies; version 1 lists them in "pool", with "pick": "random"`);
        out.pick = 'random';
    }
    if (Array.isArray(out.pool)) {
        out.pool = out.pool.map(entry => {
            const read = typeof entry === 'string' ? levelDesignShorthandEnemy(entry) : null;
            if (read) note(`${where} "pool": "${entry}" is written ${JSON.stringify(read)}`);
            return read || entry;
        });
    }
    return out;
}

// _levelDesignDraftTrigger - a draft "events" entry as a trigger: the key may
// already be one ("break:crate"), or "<layer prefix>-<name>" with the kind
// from the prefix ("breakable-crate") or from the value ("break:met").
function _levelDesignDraftTrigger(key, value) {
    if (levelDesignTrigger(key)) return levelDesignTrigger(key).text;
    const match = /^([A-Za-z]+)[-_](.+)$/.exec(String(key));
    if (!match) return null;
    const kind = LEVEL_DESIGN_DRAFT_EVENT_KIND[match[1].toLowerCase()]
              || levelDesignTrigger(value)?.kind
              || null;
    return kind ? levelDesignTrigger(`${kind}:${match[2]}`)?.text || null : null;
}

// prepareLevelDesign - a loaded design ready to run, as { design, warnings,
// migrated }: converted first when it is a draft, then validated against the
// level map. What the sandbox and, later, a real level load both call.
function prepareLevelDesign(raw, map = null) {
    if (!_levelDesignIsObject(raw)) {
        return { design: null, warnings: ['the level design is not a JSON object'], migrated: false };
    }
    const migrated = raw.version === undefined;
    const warnings = [];
    let design = raw;
    if (migrated) {
        const result = migrateLevelDesign(raw, map);
        design = result.design;
        warnings.push(...result.warnings);
    }
    warnings.push(...validateLevelDesign(design, map));
    return { design, warnings, migrated };
}

// levelDesignEnemyVariants - every enemy a version 1 design's spawn pools ask
// to have drawn differently, as [{ enemy, render }], one per enemy and render:
// the pool entries written { "enemy": ..., "render": { ... } }. What the level
// registers (enemyVariant) and waits on before it starts, so a variant's first
// frame is never blank. Entries that are not that shape are left to the checks.
function levelDesignEnemyVariants(design) {
    const found = new Map();
    const states = _levelDesignIsObject(design?.states) ? Object.values(design.states) : [];
    for (const state of states) {
        const groups = _levelDesignIsObject(state) && Array.isArray(state.spawn) ? state.spawn : [];
        for (const group of groups) {
            for (const entry of _levelDesignIsObject(group) && Array.isArray(group.pool) ? group.pool : []) {
                if (!_levelDesignIsObject(entry) || typeof entry.enemy !== 'string' || !_levelDesignIsObject(entry.render)) continue;
                const key = `${entry.enemy.trim().toLowerCase()}|${typeof variantRenderKey === 'function'
                    ? variantRenderKey(entry.render) : JSON.stringify(entry.render)}`;
                if (!found.has(key)) found.set(key, { enemy: entry.enemy.trim(), render: { ...entry.render } });
            }
        }
    }
    return [...found.values()];
}

// levelDesignLayerMoves - every layer a version 1 design moves, and how far,
// as [{ path, reach: { minX, maxX, minY, maxY } }] in the level SVG's units.
// It is what the level's scene is built with (createSvgScene's layers), since
// a moving layer is cut out of the background and its area sliced to fit the
// furthest it goes. Sorted by path, so one design always asks for one scene.
function levelDesignLayerMoves(design) {
    const byPath = new Map();
    const states = _levelDesignIsObject(design?.states) ? Object.values(design.states) : [];
    for (const state of states) {
        const moves = _levelDesignIsObject(state) && Array.isArray(state['animate-layers']) ? state['animate-layers'] : [];
        for (const move of moves) {
            if (!_levelDesignIsObject(move) || typeof move.layer !== 'string' || !move.layer.trim()) continue;
            const path = typeof levelMapLayerPath === 'function' ? levelMapLayerPath(move.layer) : move.layer.trim();
            const reach = byPath.get(path) || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
            const x = Number.isFinite(move['position-x']) ? move['position-x'] : 0;
            const y = Number.isFinite(move['position-y']) ? move['position-y'] : 0;
            reach.minX = Math.min(reach.minX, x);
            reach.maxX = Math.max(reach.maxX, x);
            reach.minY = Math.min(reach.minY, y);
            reach.maxY = Math.max(reach.maxY, y);
            byPath.set(path, reach);
        }
    }
    return [...byPath.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, reach]) => ({ path, reach }));
}

// ── Spawning ──────────────────────────────────────────────────────────────────
// Where a group's members stand once out of their layer: this far into the
// field below it, past the depth a door reaches, so nobody lands back in the
// doorway.
const LEVEL_DESIGN_SPAWN_STEP_OUT = 16;
// Side by side as they come out: the first in the middle, then left, then
// right, as a share of each one's width.
const LEVEL_DESIGN_SPAWN_LANES = [0, -1, 1];
const LEVEL_DESIGN_SPAWN_LANE_W = 0.75;

// _levelDesignDrawable - whether an enemy has art to draw. One without would
// be an invisible fight a level could not be finished without. Before the
// enemy sprites are loaded nothing can say, so everything counts.
function _levelDesignDrawable(id) {
    const def = ENEMY_DEFS[id];
    if (!def) return false;
    if (typeof _enemyPickFrame !== 'function') return true;
    return !!_enemyPickFrame(def.img, 'idle', 0);
}

// levelDesignEnemyId - the ENEMY_DEFS id a pool entry means: an enemy's id or
// art name (enemyDefId), or { "enemy", "render" }, registered as a variant
// (enemyVariant) the first time it is asked for. Null when it means none,
// the shorthand string included: the checks say how to write that.
function levelDesignEnemyId(entry) {
    if (typeof ENEMY_DEFS === 'undefined' || typeof enemyDefId !== 'function') return null;
    if (typeof entry === 'string') return enemyDefId(entry);
    if (!_levelDesignIsObject(entry) || typeof entry.enemy !== 'string') return null;
    const render = _levelDesignIsObject(entry.render) ? entry.render : {};
    return Object.keys(render).length && typeof enemyVariant === 'function'
        ? enemyVariant(entry.enemy, render)
        : enemyDefId(entry.enemy);
}

// levelDesignDefaultPool - the enemies a spawn group picks from when it names
// no pool: every enemy that is not a sub-boss or boss, by its own flags or by
// leading a stage, and that has art. Variants are left out: one exists only
// because some design asked for it, and is not every design's to pick.
function levelDesignDefaultPool() {
    if (typeof ENEMY_DEFS === 'undefined') return [];
    const leaders = new Set();
    for (const stage of typeof STAGES !== 'undefined' ? STAGES : []) {
        if (stage.subboss) leaders.add(stage.subboss);
        if (stage.boss) leaders.add(stage.boss);
    }
    const grunts = Object.keys(ENEMY_DEFS)
        .filter(id => !leaders.has(id) && !ENEMY_DEFS[id].boss && !ENEMY_DEFS[id].mini && !ENEMY_DEFS[id].variantOf);
    const drawable = grunts.filter(_levelDesignDrawable);
    return drawable.length ? drawable : grunts;
}

function _levelDesignShuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// _levelDesignPicker - a function that returns the next enemy id. "random"
// draws without repeats until the pool runs out, then reshuffles, so three
// from a pool of six are three different enemies. "in-order" goes round.
function _levelDesignPicker(pool, pick) {
    if (pick === 'in-order') {
        let i = 0;
        return () => pool[i++ % pool.length];
    }
    let bag = [];
    return () => {
        if (!bag.length) bag = _levelDesignShuffle(pool);
        return bag.pop();
    };
}

// _levelDesignFieldPoint - a feet point in the walkable field, as near the
// one asked for as the field allows: the point itself when it is in the
// field and not in a hole, else one sampled just below it, else anywhere
// near it across the field.
function _levelDesignFieldPoint(stage, feet) {
    const polygon = stageFieldPolygon(stage);
    if (!polygon) return feet;
    if (_pointInPolygon(feet.x, feet.y, polygon) && !_pointInStageHole(feet.x, feet.y, stageFieldHoles(stage))) {
        return feet;
    }
    return sampleStageFieldPoint(stage, { minX: feet.x - 60, maxX: feet.x + 60, minY: feet.y, maxY: feet.y + 120 })
        || sampleStageFieldPoint(stage, { minX: feet.x - 200, maxX: feet.x + 200 })
        || feet;
}

// ── Director ──────────────────────────────────────────────────────────────────
// LevelDirector - runs one level design for one run of a level. It listens to
// the level map's event bus, moves between states, keeps the cases, and opens
// RESTRICTED layers when their conditions come true. RESTART makes a new one;
// dispose() the old one first, or it keeps listening.
//
// Events are queued as they arrive and handled in update(), once a frame, so
// the director's own reports (which go out on the same bus) never re-enter it
// part way through a change of state.
//
// A "next" trigger that names an event fires only for an event heard while its
// state is the current one. One that names a condition ("case:", "state:")
// fires whenever the condition holds while its state is current. A
// restricted "until" holds once its condition has been true at any point in
// the run, events included.
//
// A state's "player" rules apply when the state is entered: "health" and
// "inventory" at once, and "spawn" as an entrance. The player is kept off
// stage for "after" seconds, then walks in from the left or right edge of the
// level (to the sandbox's spawn band, or its mirror on the right) or out of a
// layer, and "arrive:<state>" is reported when they get there. With "svg":
// "fade-out" the entrance starts while the screen is black. "store" keeps the
// player's health (and the inventory word) on director.carry for the next
// level to pick up.
//
// A state's "spawn" groups start when the state is entered. Each member
// appears at the foot of the group's "from" layer and walks down into the
// field, one every "every" seconds after the first "after". A group only
// spawns while the player is in the scene its layer is in; inside a building,
// its timer waits. "spawn:<group>" is reported when the first one appears,
// "defeated:<group>" once all of them have appeared and are gone.
//
// A state's "animate-layers" are sent when the state is entered, each once
// its "after" is up, and the runtime slides them (LevelMapRuntime.moveLayer).
// "position-x" and "position-y" are where the layer goes, measured from where
// the art draws it, in the level SVG's units; a layer sent to 0, 0 is back.
class LevelDirector {
    // runtime  the LevelMapRuntime of the same run. Reports go through it, so
    //          each is sent once per run, and locks are opened on it.
    // options.notify  where to say that the design cannot do something.
    // options.spawn   { minX, maxX } where "spawn": "left" walks the player to,
    //                 in world px; mirrored from the level's right edge for
    //                 "right". The sandbox passes its test's "spawn".
    constructor(design, runtime, stage, options = {}) {
        this.design   = design;
        this.runtime  = runtime;
        this.stage    = stage;
        this.notify   = options.notify || (text => console.warn('[level-design] %s', text));
        this.spawnBand = {
            minX: Number.isFinite(options.spawn?.minX) ? options.spawn.minX : 60,
            maxX: Number.isFinite(options.spawn?.maxX) ? options.spawn.maxX : 220,
        };
        this.entrance = null;           // the player coming on: { state, rules, at, walking }
        this.inventory = 'empty';       // the inventory word; there is no inventory yet
        this.carry    = null;           // what "store" kept for the next level
        this.states   = _levelDesignIsObject(design?.states) ? design.states : {};
        this.cases    = {};
        for (const [name, value] of Object.entries(_levelDesignIsObject(design?.cases) ? design.cases : {})) {
            if (typeof value === 'boolean') this.cases[name] = value;
        }
        this.state    = null;           // the current state's name
        this.visited  = new Set();      // states entered this run
        this.heard    = new Set();      // "<kind>:<key>" heard this run
        this.queue    = [];             // heard, not yet handled
        this.groups   = new Map();      // spawn group name -> its progress
        this.layerMoves = [];           // "animate-layers" still waiting on their "after"
        this.time     = 0;              // seconds of play since the design started
        this.started  = false;
        this.disposed = false;
        this.stepsThisFrame = 0;
        this.loopReported   = false;

        this._onEvent = e => {
            if (!this.disposed) this.queue.push(e.detail.event);
        };
        LEVEL_MAP_EVENTS.addEventListener('levelmap', this._onEvent);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.queue.length = 0;
        this.layerMoves.length = 0;
        LEVEL_MAP_EVENTS.removeEventListener('levelmap', this._onEvent);
        // Never leave the player off stage or mid-walk for whatever runs next.
        const p = this._player();
        if (this.entrance && p) {
            p.hidden = false;
            p.script = null;
        }
        this.entrance = null;
    }

    _player() {
        return typeof player !== 'undefined' ? player : null;
    }

    // The start state is entered on the first update, not when the director is
    // made, so whatever is listening (the sandbox checklist) is ready for it.
    update(dt, player) {
        if (this.disposed) return;
        this.stepsThisFrame = 0;
        this.time += dt;
        if (!this.started) {
            this.started = true;
            for (const [name, value] of Object.entries(this.cases)) {
                if (value) this._report('case', name);
            }
            if (this.states[this.design.start]) this._enter(this.design.start);
            else this.notify(`start state "${this.design?.start}" is not in "states", so the design does nothing`);
        }

        while (this.queue.length) {
            const event = this.queue.shift();
            this.heard.add(event);
            this._follow(step => step.on === event);
        }
        // Each move can make another state's condition true; follow them until
        // the level settles or the per-frame limit is reached.
        while (this._follow(step => this._isCondition(step.on) && this._holds(step.on))) { /* keep moving */ }
        this._updateEntrance();
        this._updateGroups();
        this._updateLayerMoves();
        this._openLocks();
    }

    // snapshot - where the design is, for the debug overlay and for tests.
    snapshot() {
        return {
            state:  this.state,
            cases:  { ...this.cases },
            locked: this.runtime ? this.runtime.restrictedEntries()
                .filter(entry => this.runtime.isLocked(entry.name)).map(entry => entry.name) : [],
            entrance: this.entrance
                ? `${this.entrance.state}: ${this.entrance.walking ? 'walking in' : 'waiting'}` : null,
            carry: this.carry ? { ...this.carry } : null,
            groups: [...this.groups.values()].map(group => ({
                name:    group.name,
                total:   group.total,
                spawned: group.spawned,
                down:    group.enemies.filter(enemy => enemy.dead).length,
                ids:     group.enemies.map(enemy => enemy.typeId),
            })),
        };
    }

    // ── States ────────────────────────────────────────────────────────────────
    // _follow - take the first of the current state's "next" steps that
    // matches. Returns whether the level moved.
    _follow(matches) {
        const steps = this.states[this.state]?.next;
        if (!Array.isArray(steps)) return false;
        const step = steps.find(s => _levelDesignIsObject(s) && matches(s) && this.states[s.to]);
        if (!step) return false;
        if (++this.stepsThisFrame > LEVEL_DESIGN_MAX_STEPS) {
            if (!this.loopReported) {
                this.loopReported = true;
                this.notify(`states keep moving on from each other in one frame (last: "${this.state}" to `
                          + `"${step.to}"); stopped at "${this.state}". Check their "case:" and "state:" triggers`);
            }
            return false;
        }
        this._enter(step.to);
        return true;
    }

    _enter(name) {
        this.state = name;
        this.visited.add(name);
        const state = this.states[name] || {};
        this._report('state', name);
        this._applySet(state.set);
        this._startGroups(state.spawn);
        this._startLayerMoves(state['animate-layers'], name);
        this._applyPlayerStats(state.player, name);

        const rules = _levelDesignIsObject(state.player) ? state.player : null;
        if (state.svg === 'fade-out' && this.runtime) {
            this.runtime.fadeThrough(this._player(), () => this._startEntrance(rules, name));
        } else {
            this._startEntrance(rules, name);
        }
    }

    // ── Player ────────────────────────────────────────────────────────────────
    // _applyPlayerStats - "health" and "inventory", at once on entering.
    _applyPlayerStats(rules, stateName) {
        const p = this._player();
        if (!_levelDesignIsObject(rules) || !p) return;
        if (rules.health === 'full') {
            p.hp = p.maxHp;
            if (typeof _hpHUD === 'function') _hpHUD(p);
        }
        if (rules.inventory === 'empty') this.inventory = 'empty';
        if (rules.health === 'store' || rules.inventory === 'store') {
            this.carry = {
                from:      stateName,
                health:    rules.health === 'store' ? p.hp : this.carry?.health ?? null,
                maxHealth: p.maxHp,
                inventory: rules.inventory === 'store' ? this.inventory : this.carry?.inventory ?? null,
            };
        }
    }

    // _startEntrance - begin bringing the player on, if the rules place them.
    _startEntrance(rules, stateName) {
        const p = this._player();
        if (!rules || rules.spawn === undefined || !p) return;
        const after = typeof rules.after === 'number' && rules.after > 0 ? rules.after : 0;
        this.entrance = { state: stateName, rules, at: this.time + after, walking: false };
        if (after > 0) {
            p.hidden = true;
            p.script = null;
        }
        this._updateEntrance();
    }

    // _updateEntrance - wait out "after", then place the player and walk them
    // in; report "arrive:<state>" once they are standing where they belong.
    _updateEntrance() {
        const entrance = this.entrance;
        const p = this._player();
        if (!entrance || !p) return;
        if (!entrance.walking) {
            if (this.time < entrance.at) return;
            const path = this._entrancePath(entrance.rules.spawn, p);
            if (!path) {
                this.notify(`state "${entrance.state}": the player cannot be placed at "${entrance.rules.spawn}"`);
                p.hidden = false;
                this.entrance = null;
                return;
            }
            p.hidden = false;
            p.vx = p.vy = 0;
            p.x = path.from.x;
            p.y = path.from.y;
            if (path.camX !== undefined) cam.x = path.camX;
            if (entrance.rules.animation === 'idle') {
                p.x = path.to.x;
                p.y = path.to.y;
                p.clampToStageField();
            } else {
                p.walkTo(path.to.x, path.to.y, CFG.playerSpeed);
            }
            entrance.walking = true;
        }
        if (p.script) return;
        this.entrance = null;
        this._report('arrive', entrance.state);
    }

    // _entrancePath - where the player starts and where they walk to, both as
    // the hit box's top-left, plus where the camera should be: off the level's
    // left edge to the spawn band, off its right edge to the band's mirror,
    // or the foot of a layer to the ground below it, as enemies come out of a
    // door. Null when the place cannot be found.
    _entrancePath(spawn, p) {
        const stage = this.runtime?.stage || this.stage;
        const scene = stage?.scene;
        if (spawn === 'left' || spawn === 'right') {
            const worldW = scene?.worldWidth || W;
            const band = spawn === 'left' ? this.spawnBand : {
                minX: worldW - this.spawnBand.maxX - p.w,
                maxX: worldW - this.spawnBand.minX - p.w,
            };
            const to = sampleStageEntityPosition(stage, p.w, p.h, band) || { x: band.minX, y: p.y };
            return {
                from: { x: spawn === 'left' ? -p.w - 8 : worldW + 8, y: to.y },
                to,
                camX: spawn === 'left' ? 0 : Math.max(0, worldW - W),
            };
        }
        const place = this._findLayer(spawn);
        if (!place) return null;
        const rect = place.region.world;
        const footX = rect.x + rect.w * 0.5;
        const footY = rect.y + rect.h;
        const gap = levelFieldGapBelow(place.stage, rect);
        const feet = _levelDesignFieldPoint(place.stage, {
            x: footX, y: footY + gap + CFG.enterDepthTol + LEVEL_DESIGN_SPAWN_STEP_OUT,
        });
        const worldW = place.stage?.scene?.worldWidth || W;
        return {
            from: { x: footX - p.w * 0.5, y: footY - p.h },
            to:   { x: feet.x - p.w * 0.5, y: feet.y - p.h },
            camX: Math.max(0, Math.min(Math.max(0, worldW - W), footX - W * 0.5)),
        };
    }

    _applySet(set) {
        if (!_levelDesignIsObject(set)) return;
        for (const [name, value] of Object.entries(set)) {
            if (typeof value !== 'boolean') continue;
            const was = this.cases[name];
            this.cases[name] = value;
            if (value && !was) this._report('case', name);
        }
    }

    // ── Spawn groups ──────────────────────────────────────────────────────────
    // _startGroups - set a state's spawn groups going. A group that cannot run
    // (no such layer, no enemies to pick) says why once and is skipped; the
    // validator has usually said so already, before play.
    _startGroups(list) {
        for (const spec of Array.isArray(list) ? list : []) {
            if (!_levelDesignIsObject(spec) || typeof spec.group !== 'string') continue;
            if (spec.type !== 'enemy') {
                this.notify(`spawn "${spec.group}": type "${spec.type}" is not built, so nobody comes`);
                continue;
            }
            const place = this._findLayer(spec.from);
            if (!place) {
                this.notify(`spawn "${spec.group}": there is no layer "${spec.from}" here, so nobody comes out`);
                continue;
            }
            const pool = Array.isArray(spec.pool)
                ? spec.pool.map(entry => levelDesignEnemyId(entry)).filter(Boolean)
                : levelDesignDefaultPool();
            if (!pool.length) {
                this.notify(`spawn "${spec.group}": its pool has no enemies, so nobody comes`);
                continue;
            }
            const seconds = value => (typeof value === 'number' && value >= 0 ? value : 0);
            this.groups.set(spec.group, {
                name:     spec.group,
                stage:    place.stage,
                rect:     place.region.world,
                gap:      levelFieldGapBelow(place.stage, place.region.world),
                total:    Number.isInteger(spec.count) && spec.count >= 1 ? spec.count : 1,
                walk:     spec.animation !== 'idle',
                pick:     _levelDesignPicker(pool, spec.pick),
                nextAt:   this.time + seconds(spec.after),
                every:    seconds(spec.every),
                spawned:  0,
                enemies:  [],
                defeated: false,
            });
        }
    }

    // _findLayer - a layer path in the scene the player is in, or one they
    // went in from, as { stage, region }.
    _findLayer(path) {
        const stages = this.runtime
            ? [this.runtime.stage, ...[...this.runtime.stack].reverse().map(frame => frame.stage)]
            : [this.stage];
        for (const stage of stages) {
            const region = levelMapFind(stage?.scene?.map, path);
            if (region) return { stage, region };
        }
        return null;
    }

    _updateGroups() {
        for (const group of this.groups.values()) {
            if (group.spawned < group.total) {
                const here = !this.runtime || this.runtime.stage === group.stage;
                if (!here) {
                    // Inside somewhere else: the next one waits for the
                    // player's return rather than piling up.
                    group.nextAt = Math.max(group.nextAt, this.time);
                    continue;
                }
                while (group.spawned < group.total && this.time >= group.nextAt) {
                    this._spawnOne(group);
                    group.nextAt += group.every;
                }
            }
            if (!group.defeated && group.spawned === group.total
                && group.enemies.every(enemy => enemy.isDone)) {
                group.defeated = true;
                this._report('defeated', group.name);
            }
        }
    }

    // _spawnOne - the next member of a group, at the foot of its layer,
    // walking down to a place in the field beside the ones before it: past
    // the gap between the layer and the field (levelFieldGapBelow), and past
    // the depth a door reaches, so nobody stands in the doorway.
    _spawnOne(group) {
        const id   = group.pick();
        const def  = ENEMY_DEFS[id];
        const i    = group.spawned;
        const door = group.rect;
        const footX = door.x + door.w * 0.5;
        const footY = door.y + door.h;

        const enemy = new Enemy(footX - def.w * 0.5, footY - def.h, id);
        enemy.spawnGroup = group.name;
        enemy.flankDir   = i % 2 === 0 ? 1 : -1;

        const lane = LEVEL_DESIGN_SPAWN_LANES[i % LEVEL_DESIGN_SPAWN_LANES.length];
        const target = _levelDesignFieldPoint(group.stage, {
            x: footX + lane * def.w * LEVEL_DESIGN_SPAWN_LANE_W,
            y: footY + group.gap + CFG.enterDepthTol + LEVEL_DESIGN_SPAWN_STEP_OUT,
        });
        if (group.walk) {
            enemy.walkTo(target.x - def.w * 0.5, target.y - def.h, enemy.speed * CFG.enemySpeedMultiplier);
        } else {
            enemy.x = target.x - def.w * 0.5;
            enemy.y = target.y - def.h;
            enemy.clampToStageField();
        }

        enemies.push(enemy);
        group.enemies.push(enemy);
        group.spawned++;
        if (group.spawned === 1) this._report('spawn', group.name);
    }

    // ── Moving layers ─────────────────────────────────────────────────────────
    // _startLayerMoves - queue a state's "animate-layers", each to be sent once
    // its "after" is up. One still waiting when the state is left is sent all
    // the same, as a spawn group carries on: entering the state asked for it.
    _startLayerMoves(list, stateName) {
        const seconds = value => (typeof value === 'number' && value >= 0 ? value : 0);
        const axis = value => (Number.isFinite(value) ? value : null);
        for (const spec of Array.isArray(list) ? list : []) {
            if (!_levelDesignIsObject(spec) || typeof spec.layer !== 'string') continue;
            this.layerMoves.push({
                state: stateName,
                path:  spec.layer,
                at:    this.time + seconds(spec.after),
                to:    { x: axis(spec['position-x']), y: axis(spec['position-y']),
                         ease: spec.type, duration: seconds(spec.duration) },
            });
        }
        this._updateLayerMoves();
    }

    // _updateLayerMoves - send the moves whose time has come. A layer that
    // cannot move says why once, when it would have; the validator has
    // usually said so already, before play.
    _updateLayerMoves() {
        if (!this.layerMoves.length) return;
        const due = this.layerMoves.filter(move => this.time >= move.at);
        this.layerMoves = this.layerMoves.filter(move => this.time < move.at);
        for (const move of due) {
            if (!this.runtime) {
                this.notify(`state "${move.state}": "animate-layers" needs the level map, so "${move.path}" stays put`);
            } else if (!this.runtime.moveLayer(move.path, move.to)) {
                this.notify(`state "${move.state}": "${move.path}" is not a layer this scene can move, so it stays put`);
            }
        }
    }

    // ── Conditions ────────────────────────────────────────────────────────────
    _isCondition(text) {
        const parsed = levelDesignTrigger(text);
        return !!parsed && LEVEL_DESIGN_VOCAB.triggers.condition.includes(parsed.kind);
    }

    // _holds - whether a trigger is true now: a case that is true, a state that
    // has been entered, or an event that has been heard this run.
    _holds(text) {
        const parsed = levelDesignTrigger(text);
        if (!parsed) return false;
        if (parsed.kind === 'case')  return this.cases[parsed.key] === true;
        if (parsed.kind === 'state') return this.visited.has(parsed.key);
        return this.heard.has(parsed.text);
    }

    // ── Locks ─────────────────────────────────────────────────────────────────
    // A RESTRICTED opens on its "restricted" entry's "until" when the design
    // has one, else when every REQUIRE- layer inside it holds. One with
    // neither stays locked (the level map warns about that when it is read).
    _openLocks() {
        if (!this.runtime) return;
        const restricted = _levelDesignIsObject(this.design.restricted) ? this.design.restricted : {};
        for (const entry of this.runtime.restrictedEntries()) {
            if (!this.runtime.isLocked(entry.name)) continue;
            const until = restricted[entry.name]?.until;
            const open = until !== undefined
                ? this._holds(until)
                : entry.requires.length > 0 && entry.requires.every(req =>
                    req.type === 'case'  ? this.cases[req.name] === true
                  : req.type === 'state' ? this.visited.has(req.name)
                  : false);
            if (open) this.runtime.unlock(entry.name);
        }
    }

    // Through the runtime, so each report goes out once per run; straight to
    // the bus when there is no runtime.
    _report(kind, key) {
        if (this.runtime) this.runtime.report(kind, key);
        else levelMapEmit(kind, key);
    }
}

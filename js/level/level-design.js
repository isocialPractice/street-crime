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
const _LEVEL_DESIGN_SPAWN_KEYS = ['group', 'type', 'count', 'pick', 'pool', 'order', 'from', 'animation', 'after', 'every',
                                  'then', 'inherit'];

const LEVEL_DESIGN_VOCAB = _levelDesignFreeze({
    version: 1,

    // The keys each object may carry.
    keys: {
        top:        ['$schema', 'version', 'start', 'groups', 'cases', 'restricted', 'look', 'states'],
        restricted: ['until', 'type'],
        state:      ['svg', 'set', 'cases', 'reset', 'player', 'spawn', 'animate-layers', 'characters', 'next'],
        // A case that follows a condition: { "condition": "alive = 0" }.
        caseCondition: ['condition'],
        player:     ['spawn', 'after', 'animation', 'inventory', 'health'],
        spawn:      _LEVEL_DESIGN_SPAWN_KEYS,
        // A group defined once under "groups": every spawn key but the two
        // that say where it is filed ("groups" > <type> > <group>).
        group:      _LEVEL_DESIGN_SPAWN_KEYS.filter(key => key !== 'group' && key !== 'type'),
        animateLayer: ['layer', 'position-x', 'position-y', 'type', 'duration', 'after'],
        // A pool entry written as an object: an enemy, how many of it, how
        // many of those drawn with a render, and a name for "order" lists.
        poolEntry:  ['enemy', 'render', 'count', 're-render', 'name'],
        characters: ['friendly', 'neutral'],
        next:       ['on', 'when', 'to'],
    },

    // The values a key may take.
    values: {
        // "loads" and "none" both leave the art as it is; "none" reads better
        // on a state that is not the first.
        svg:         ['loads', 'layer-state-change', 'fade-out', 'none'],
        playerSpawn: ['left', 'right'],
        animation:   ['walk', 'idle'],
        inventory:   ['empty', 'inherit', 'store'],
        health:      ['full', 'inherit', 'store'],
        spawnType:   ['enemy'],
        pick:        ['random', 'in-order'],
        // The order a group's members come out in, once "pick" has chosen
        // them; "order" may also be a list of names. "load" is "same".
        order:       ['random', 'sequence', 'reverse', 'same', 'load'],
        // What a group does once it is out: fight, or stand a moment and run
        // off the nearest edge of the view.
        then:        ['fight', 'flee'],
        // A spawn's "from" may name this instead of a layer: just off the
        // view's left and right edges, taking turns.
        spawnFrom:   ['edges'],
        // How a "restricted" entry's "until" opens its door: once for the run,
        // or for as long as it holds.
        restrictedType: ['once', 'condition'],
        // What a state's "reset" can put back, as "<kind>:<name>", or "level".
        reset:       ['break', 'animate', 'unlock', 'case'],
        resetAll:    'level',
        // How a moving layer travels: LEVEL_LAYER_EASES in
        // js/entities/level-objects.js has one of each.
        ease:        ['linear', 'ease-in', 'ease-out', 'ease-in-out'],
    },

    // A case's "condition": "<source>[:<name>] [<op> <whole number>]". Count
    // sources compare a number (no op: at least 1); flag sources are true or
    // false and take no op.
    conditions: {
        count: ['alive', 'fled', 'inventory'],
        flag:  ['case', 'state'],
        ops:   ['=', '==', '!=', '<', '<=', '>', '>='],
    },

    // What "on" and "until" can name, as "<kind>:<key>".
    //   map       reported by the level map's runtime (js/level/level-runtime.js)
    //   director  reported by the director: "spawn:<group>" and
    //             "defeated:<group>" for the groups it spawns ("fled:<group>"
    //             instead when any of them ran off), "arrive:<state>" when the
    //             player has finished coming on for that state
    //   condition true or false right now, not an event: "case:<name>" is that
    //             case being true, "state:<name>" is that state having been entered
    //   player    what the player does, every time: with items (js/entities/
    //             items.js) "take:<item>", "use:<item>", "drop:<item>",
    //             "combine:<made>"; on the command line (js/ui/parser.js)
    //             "look:<name>" ("look:ground") and "talk:<group or enemy>"
    triggers: {
        map:       ['animate', 'break', 'enter', 'exit', 'interact', 'event', 'locked', 'unlock', 'lock'],
        director:  ['spawn', 'defeated', 'fled', 'arrive'],
        condition: ['case', 'state'],
        player:    ['take', 'use', 'drop', 'combine', 'look', 'talk'],
    },
    // The player kinds whose name is an item, checked against the catalog.
    itemTriggers: ['take', 'use', 'drop', 'combine'],

    // What the director reports on the level map's event bus, as "<kind>:<key>".
    // "unlock" and "lock" are sent by the runtime when the director opens a
    // RESTRICTED, or closes one that follows a condition.
    reports: ['state', 'case', 'spawn', 'defeated', 'fled', 'arrive', 'unlock', 'lock'],
});

const LEVEL_DESIGN_TRIGGER_RE = /^([a-z]+):([A-Za-z0-9][A-Za-z0-9_-]*)$/;
const LEVEL_DESIGN_NAME_RE    = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// Other words a spawn's keys get written as, and the key each one is. A
// version 1 file is told to write the key; a draft is converted; either way
// the game reads it, so a design works while it says so.
const LEVEL_DESIGN_SPAWN_ALIASES = _levelDesignFreeze({ timeout: 'every' });

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

// ── Conditions ────────────────────────────────────────────────────────────────
// A case can follow a condition instead of holding a value:
//   "has-key":          { "condition": "inventory:key" }
//   "enemies-defeated": { "condition": "alive = 0" }
// "<source>[:<name>] [<op> <whole number>]", read every frame.
const LEVEL_DESIGN_CONDITION_RE = /^\s*([a-z]+)\s*(?::\s*([A-Za-z0-9][A-Za-z0-9_-]*))?\s*(?:(==|=|!=|<=|>=|<|>)\s*(\d+))?\s*$/;

// levelDesignCondition - a condition as { source, name, op, value, text },
// or null when the text is not one. The source is not checked here.
function levelDesignCondition(text) {
    const match = LEVEL_DESIGN_CONDITION_RE.exec(String(text ?? ''));
    if (!match) return null;
    const [, source, name = null, op = null, value = null] = match;
    return {
        source, name, op: op === '==' ? '=' : op, value: value === null ? null : Number(value),
        text: `${source}${name ? `:${name}` : ''}${op ? ` ${op === '==' ? '=' : op} ${value}` : ''}`,
    };
}

// levelDesignCompare - n against a condition's op and value. No op means "at
// least 1": a count that is there, a flag (1 or 0) that is true.
function levelDesignCompare(n, op, value) {
    switch (op) {
        case '=':  return n === value;
        case '!=': return n !== value;
        case '<':  return n < value;
        case '<=': return n <= value;
        case '>':  return n > value;
        case '>=': return n >= value;
        default:   return n >= 1;
    }
}

// The shorthand a condition case gets written in before the format is known,
// in a "cases" object: "<name>": "condition", with these keys beside it.
//   "enemies-defeated": "condition", "conditional": "length=0"
//   "has-key": "condition", "conditional": "player.inventory", "player-inventory": "key"
const LEVEL_DESIGN_CASE_SHORTHAND_KEYS = ['conditional', 'player-inventory'];

// _levelDesignShorthandCondition - what a "conditional" beside a shorthand
// case means, as condition text: "length=0" counts enemies, as "alive = 0";
// "player.inventory" is an item carried. Null when it cannot be read.
function _levelDesignShorthandCondition(cases) {
    const text = String(cases?.conditional ?? '').trim();
    if (/^player\.inventory$/i.test(text)) {
        const item = cases['player-inventory'];
        return typeof item === 'string' && item.trim() ? `inventory:${item.trim()}` : 'inventory';
    }
    const length = /^length\s*(==|=|!=|<=|>=|<|>)\s*(\d+)$/i.exec(text);
    if (length) return `alive ${length[1] === '==' ? '=' : length[1]} ${length[2]}`;
    return levelDesignCondition(text) ? text : null;
}

// levelDesignCaseEntries - a "cases" object (the top one, or a state's) as
// [{ name, value, condition, shorthand, bad }]: value the starting true or
// false of a plain case (null for a condition), condition the text of one,
// from { "condition": ... } or from the shorthand, whose "conditional" keys
// are then not cases of their own. bad is a value that is neither.
function levelDesignCaseEntries(cases) {
    if (!_levelDesignIsObject(cases)) return [];
    const shorthand = Object.values(cases).includes('condition');
    const out = [];
    for (const [name, value] of Object.entries(cases)) {
        if (shorthand && LEVEL_DESIGN_CASE_SHORTHAND_KEYS.includes(name)) continue;
        if (typeof value === 'boolean') {
            out.push({ name, value, condition: null, shorthand: false, bad: false });
        } else if (_levelDesignIsObject(value) && typeof value.condition === 'string') {
            out.push({ name, value: null, condition: value.condition, shorthand: false, bad: false });
        } else if (value === 'condition') {
            out.push({ name, value: null, condition: _levelDesignShorthandCondition(cases), shorthand: true, bad: false });
        } else {
            out.push({ name, value, condition: null, shorthand: false, bad: true });
        }
    }
    return out;
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
    const { map, director, condition, player } = LEVEL_DESIGN_VOCAB.triggers;
    return [...map, ...director, ...condition, ...player];
}

// _levelDesignItemIds - the items of the catalog in use (js/entities/
// items.js), or null when none is loaded, which skips checks of item names.
function _levelDesignItemIds() {
    return typeof ITEM_CATALOG !== 'undefined' && ITEM_CATALOG.path ? Object.keys(ITEM_CATALOG.items) : null;
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
        lock:     new Set(restricted),
    };
}

// What a map kind names, for a warning that says what was looked for.
const LEVEL_DESIGN_MAP_KIND_LABEL = {
    animate: 'ANIMATE-', break: 'BREAKABLE-', enter: 'ENTERABLE- or RESTRICTED-',
    exit: 'ENTERABLE- or RESTRICTED-', interact: 'OBJECT-', event: 'EVENT-',
    locked: 'RESTRICTED-', unlock: 'RESTRICTED-', lock: 'RESTRICTED-',
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
        if (_levelDesignIsObject(entry.enemy)) {
            entry = _levelDesignFlatPoolEntry(entry);
            warn(`${where} names its enemy as an object; it is read the same, written flat: ${JSON.stringify(entry)}`);
        }
        unknownKeys(entry, V.keys.poolEntry, where);
        if (typeof entry.enemy !== 'string' || !entry.enemy.trim()) {
            warn(`${where} needs "enemy", the enemy to draw`);
            return;
        }
        const id = enemyName(entry.enemy, `${where} "enemy"`);
        const count = Number.isInteger(entry.count) && entry.count >= 1 ? entry.count : 1;
        if (entry.count !== undefined && !(Number.isInteger(entry.count) && entry.count >= 1)) {
            warn(`${where} "count" should be a whole number, 1 or more`);
        }
        const reRender = entry['re-render'];
        if (reRender !== undefined) {
            if (!(Number.isInteger(reRender) && reRender >= 0)) {
                warn(`${where} "re-render" should be a whole number: how many of its ${count} are drawn with the render`);
            } else if (reRender > count) {
                warn(`${where} "re-render" is ${reRender}, more than its "count" of ${count}`);
            }
            if (entry.render === undefined) warn(`${where} has "re-render" but no "render" to draw them with`);
        }
        if (entry.name !== undefined && (typeof entry.name !== 'string' || !LEVEL_DESIGN_NAME_RE.test(entry.name))) {
            warn(`${where} "name" should be a name: letters, digits, - and _`);
        }
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
    // The keys a spawn is also written with ("timeout" for "every"): read all
    // the same, and the file is told which key to write.
    const aliasKeys = (spec, at) => {
        for (const [alias, key] of Object.entries(LEVEL_DESIGN_SPAWN_ALIASES)) {
            if (spec[alias] === undefined) continue;
            if (spec[key] !== undefined) {
                warn(`${at} has "${alias}" and "${key}"; "${alias}" is ignored`);
            } else {
                const read = levelDesignSeconds(spec[alias]);
                warn(`${at}: "${alias}" is "${key}" in version 1; write "${key}": ${read !== null ? read : 1}`);
            }
        }
    };
    // The fields of a spawn, or of a group under "groups", each checked where
    // it is written: a group's mistake is reported once, under the group,
    // however many states spawn it.
    const spawnFields = (spec, at) => {
        aliasKeys(spec, at);
        if (spec.count !== undefined && !(Number.isInteger(spec.count) && spec.count >= 1)) {
            warn(`${at} "count" should be a whole number, 1 or more`);
        }
        if (Array.isArray(spec.pick)) {
            warn(`${at} "pick" lists enemies; list them in "pool", and write "pick": "random" or "in-order"`);
            if (spec.pool === undefined) spec.pick.forEach((entry, n) => poolEntry(entry, `${at} "pick" #${n + 1}`));
        } else {
            oneOf(spec.pick, V.values.pick, `${at} "pick"`);
        }
        if (spec.pool !== undefined) {
            if (!Array.isArray(spec.pool) || !spec.pool.length) {
                warn(`${at} "pool" should be a list of enemies`);
            } else {
                const names = new Set();
                spec.pool.forEach((entry, n) => {
                    poolEntry(entry, `${at} "pool" #${n + 1}`);
                    const name = levelDesignPoolEntry(entry)?.name;
                    if (!name) return;
                    if (names.has(name.toLowerCase())) warn(`${at} "pool" #${n + 1}: another entry is also named "${name}"`);
                    names.add(name.toLowerCase());
                });
            }
        }
        if (Array.isArray(spec.order)) {
            spec.order.forEach((name, n) => {
                if (!(typeof name === 'string' && name.trim()) && !(Number.isInteger(name) && name >= 1)) {
                    warn(`${at} "order" #${n + 1} should be a pool entry's name, an enemy, or a pool position from 1`);
                }
            });
        } else if (spec.order !== undefined) {
            if (typeof spec.order !== 'string') {
                warn(`${at} "order" should be one of ${V.values.order.join(', ')}, or a list of names`);
            } else {
                oneOf(spec.order, V.values.order, `${at} "order"`);
            }
        }
        if (spec.from !== undefined) {
            if (typeof spec.from !== 'string') warn(`${at} "from" should be a layer path, or "edges"`);
            else if (!V.values.spawnFrom.includes(spec.from)) layerPath(spec.from, `${at} "from"`);
        }
        oneOf(spec.animation, V.values.animation, `${at} "animation"`);
        seconds(spec.after, `${at} "after"`);
        seconds(spec.every, `${at} "every"`);
        oneOf(spec.then, V.values.then, `${at} "then"`);
        if (spec.inherit !== undefined && typeof spec.inherit !== 'boolean') {
            warn(`${at} "inherit" should be true or false`);
        }
    };
    // An "order" list's names, against the pool they choose among: each must
    // find a member, and none more often than the pool has of it. Without a
    // pool (every grunt) the names can only be enemies.
    const orderNames = (spec, at) => {
        if (!Array.isArray(spec.order)) return;
        if (!Array.isArray(spec.pool)) {
            spec.order.forEach(name => {
                if (typeof name === 'string') enemyName(name, `${at} "order"`);
                else if (Number.isInteger(name)) warn(`${at} "order" has position ${name}, but there is no "pool" to count in`);
            });
            return;
        }
        const slots = levelDesignPoolSlots(spec.pool);
        const left = [...slots];
        const known = [...new Set(slots.flatMap(slot => [slot.name, slot.enemy].filter(Boolean)))];
        for (const name of spec.order) {
            if (!(typeof name === 'string' && name.trim()) && !Number.isInteger(name)) continue;
            if (_levelDesignOrderTake(left, name)) continue;
            warn(slots.some(slot => _levelDesignOrderScore(slot, name) > 0)
                ? `${at} "order" lists "${name}" more times than the pool has of it`
                : `${at} "order" names "${name}", which is not in the pool${_levelDesignDidYouMean(String(name), known)}`);
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

    // The item catalog in use, when there is one, for item names.
    const itemIds = _levelDesignItemIds();

    // Cases, by name: a plain one with its starting value, or one that
    // follows a condition. The shorthand's "conditional" keys are not cases.
    const rawCases = _levelDesignIsObject(design.cases) ? design.cases : {};
    const cases = Object.fromEntries(levelDesignCaseEntries(rawCases).map(entry => [entry.name, entry]));
    if (design.cases !== undefined && !_levelDesignIsObject(design.cases)) {
        warn('"cases" should be an object of names, each true, false or { "condition": ... }');
    }

    const groups = new Set();
    for (const state of Object.values(states)) {
        for (const group of Array.isArray(state?.spawn) ? state.spawn : []) {
            if (typeof group?.group === 'string') groups.add(group.group);
        }
    }

    // A condition names what it counts, and each name has to be something.
    const conditionText = (text, at) => {
        const c = levelDesignCondition(text);
        const sources = [...V.conditions.count, ...V.conditions.flag];
        if (!c) {
            warn(`${at} is "${text}"; write a condition as <source>[:<name>] [<op> <number>], `
               + 'such as "alive = 0" or "inventory:key"');
            return;
        }
        if (!sources.includes(c.source)) {
            const close = levelDesignClosest(c.source, sources);
            warn(`${at}: "${c.source}" is not a condition source; ${close ? `did you mean "${close}"? ` : ''}`
               + `use one of ${sources.join(', ')}`);
            return;
        }
        if (V.conditions.flag.includes(c.source)) {
            if (!c.name) warn(`${at}: "${c.source}" needs a name, as "${c.source}:<name>"`);
            if (c.op) warn(`${at}: "${c.source}:" is true or false; leave out "${c.op} ${c.value}"`);
        }
        if (c.source === 'fled' && !c.name) warn(`${at}: "fled" needs a group, as "fled:<group>"`);
        if (!c.name) return;
        if (c.source === 'case' && !(c.name in cases)) {
            warn(`${at} reads case "${c.name}", which is not in "cases"${_levelDesignDidYouMean(c.name, Object.keys(cases))}`);
        } else if (c.source === 'state' && !stateNames.includes(c.name)) {
            warn(`${at} reads state "${c.name}", which is not in "states"${_levelDesignDidYouMean(c.name, stateNames)}`);
        } else if ((c.source === 'alive' || c.source === 'fled') && !groups.has(c.name)) {
            warn(`${at} counts group "${c.name}", which no state spawns${_levelDesignDidYouMean(c.name, [...groups])}`);
        } else if (c.source === 'inventory' && itemIds && !itemIds.includes(c.name)) {
            warn(`${at} counts item "${c.name}", which is not in ${ITEM_CATALOG.path}${_levelDesignDidYouMean(c.name, itemIds)}`);
        }
    };
    // A case's value, in the top "cases" or a state's: raw is what is written.
    const caseValue = (entry, raw, at) => {
        if (entry.bad) {
            warn(`${at} should be true, false or { "condition": "<condition>" }`);
            return;
        }
        if (entry.shorthand) {
            if (entry.condition === null) {
                warn(`${at} is written "condition", but its "conditional" cannot be read; `
                   + 'write { "condition": ... }, such as { "condition": "alive = 0" }');
                return;
            }
            warn(`${at} is written as shorthand; write "${entry.name}": ${JSON.stringify({ condition: entry.condition })}`);
        } else if (entry.condition !== null) {
            unknownKeys(raw, V.keys.caseCondition, at);
        }
        if (entry.condition !== null) conditionText(entry.condition, `${at} "condition"`);
    };
    for (const entry of Object.values(cases)) caseValue(entry, rawCases[entry.name], `case "${entry.name}"`);

    // Groups defined once, under their spawn type, for states to spawn by name.
    if (design.groups !== undefined && !_levelDesignIsObject(design.groups)) {
        warn('"groups" should be an object of spawn types, such as { "enemy": { "<group>": { ... } } }');
    }
    for (const [type, defs] of Object.entries(_levelDesignIsObject(design.groups) ? design.groups : {})) {
        if (!V.values.spawnType.includes(type)) {
            const close = levelDesignClosest(type, V.values.spawnType);
            warn(`"groups" has "${type}", which is not a spawn type; ${close ? `did you mean "${close}"? ` : ''}`
               + `use ${V.values.spawnType.join(', ')}`);
            continue;
        }
        if (!_levelDesignIsObject(defs)) {
            warn(`"groups" "${type}" should be an object of group names`);
            continue;
        }
        for (const [name, def] of Object.entries(defs)) {
            const at = `group "${name}"`;
            if (!LEVEL_DESIGN_NAME_RE.test(name)) warn(`${at}: use letters, digits, - and _ in a group name`);
            if (!_levelDesignIsObject(def)) {
                warn(`${at} should be an object of spawn keys, such as "pool" and "every"`);
                continue;
            }
            for (const key of ['group', 'type'].filter(key => def[key] !== undefined)) {
                warn(`${at}: "${key}" is where the group is filed ("groups" > "${type}" > "${name}"); leave it out`);
            }
            unknownKeys(Object.fromEntries(Object.entries(def).filter(([key]) => key !== 'group' && key !== 'type')),
                        [...V.keys.group, ...Object.keys(LEVEL_DESIGN_SPAWN_ALIASES)], at);
            spawnFields(def, at);
            orderNames(def, at);
            if (!groups.has(name)) warn(`${at} is defined under "groups", but no state spawns it`);
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
        } else if (LEVEL_DESIGN_VOCAB.triggers.player.includes(kind)) {
            if (LEVEL_DESIGN_VOCAB.itemTriggers.includes(kind) && itemIds && !itemIds.includes(key)) {
                warn(`${where} waits on "${kind}:${key}", but ${ITEM_CATALOG.path} has no item "${key}"`
                   + _levelDesignDidYouMean(key, itemIds));
            }
        } else if ((kind === 'spawn' || kind === 'defeated' || kind === 'fled') && !groups.has(key)) {
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

    // What LOOK says about things, by layer name: an OBJECT-, a BREAKABLE-, an
    // ENTERABLE- or RESTRICTED- (for its door), an INVENTORY- item.
    if (design.look !== undefined) {
        if (!_levelDesignIsObject(design.look)) {
            warn('"look" should be an object of layer names and what LOOK says about each');
        } else {
            const named = map ? [...new Set([
                ...map.objects.map(entry => entry.name), ...map.breakables.map(entry => entry.name),
                ...map.enterables.map(entry => entry.name), ...(map.items || []).map(entry => entry.name),
            ])] : null;
            for (const [name, text] of Object.entries(design.look)) {
                if (typeof text !== 'string' || !text.trim()) warn(`look "${name}" should be the sentence LOOK says`);
                if (named && !named.includes(name)) {
                    warn(`look "${name}": the level SVG has no OBJECT-, BREAKABLE-, ENTERABLE- or RESTRICTED-${name}`
                       + `${_levelDesignDidYouMean(name, named)} (ignore this if it is inside an interior)`);
                }
            }
        }
    }

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
        oneOf(entry.type, V.values.restrictedType, `${where} "type"`);
        if (mapNames && !mapNames.locked.has(name)) {
            warn(`${where}: the level SVG has no RESTRICTED-${name}`);
        }
    }

    // States
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

        // A state's cases: conditions the named cases follow from here on.
        if (state.cases !== undefined) {
            if (!_levelDesignIsObject(state.cases)) {
                warn(`${where} "cases" should be an object of case names and { "condition": ... }`);
            } else {
                for (const entry of levelDesignCaseEntries(state.cases)) {
                    const at = `${where} case "${entry.name}"`;
                    if (!(entry.name in cases)) {
                        warn(`${at} is not in the top "cases", which gives its value until this state`
                           + _levelDesignDidYouMean(entry.name, Object.keys(cases)));
                    }
                    if (typeof entry.value === 'boolean') {
                        warn(`${at} is ${entry.value}; a state's "cases" give conditions, and a value goes in "set"`);
                        continue;
                    }
                    caseValue(entry, state.cases[entry.name], at);
                    if (_levelDesignIsObject(state.set) && entry.name in state.set) {
                        warn(`${where} both sets case "${entry.name}" and gives it a condition; the condition wins`);
                    }
                }
            }
        }

        // What a state puts back: "level", or a list of what reported it.
        if (state.reset !== undefined && state.reset !== V.values.resetAll) {
            if (!Array.isArray(state.reset)) {
                warn(`${where} "reset" should be "level" or a list, such as ["break:parking-gate-arm"]`);
            } else {
                const moved = levelDesignLayerMoves(design).map(move => move.path.split('/').pop());
                for (const item of state.reset) {
                    const at = `${where} "reset" "${item}"`;
                    const parsed = levelDesignTrigger(item);
                    if (!parsed || !V.values.reset.includes(parsed.kind)) {
                        const kind = String(item).split(':')[0];
                        const close = levelDesignClosest(kind, V.values.reset);
                        warn(`${at}: write what to put back as <kind>:<name>, the kind one of ${V.values.reset.join(', ')}`
                           + (close && close !== kind ? `; did you mean "${close}:"?` : ''));
                    } else if (parsed.kind === 'case' && !(parsed.key in cases)) {
                        warn(`${at} names case "${parsed.key}", which is not in "cases"`
                           + _levelDesignDidYouMean(parsed.key, Object.keys(cases)));
                    } else if (parsed.kind === 'animate' && !moved.includes(parsed.key)) {
                        warn(`${at}: no state moves a layer "${parsed.key}"${_levelDesignDidYouMean(parsed.key, moved)}`);
                    } else if (mapNames?.[parsed.kind] && !mapNames[parsed.kind].has(parsed.key)) {
                        warn(`${at}: the level SVG has no ${LEVEL_DESIGN_MAP_KIND_LABEL[parsed.kind]}${parsed.key}`
                           + _levelDesignDidYouMean(parsed.key, [...mapNames[parsed.kind]]));
                    }
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
        // A spawn's own keys are checked as written, then laid over the group
        // it names (levelDesignSpawn) for what may come from either: its type,
        // its "from", an "order" list against the pool it ends up with.
        const seenGroups = new Set();
        for (const [i, group] of (Array.isArray(state.spawn) ? state.spawn : []).entries()) {
            const at = `${where} spawn ${typeof group?.group === 'string' ? `"${group.group}"` : `#${i + 1}`}`;
            if (!_levelDesignIsObject(group)) {
                warn(`${at} should be an object`);
                continue;
            }
            unknownKeys(group, [...V.keys.spawn, ...Object.keys(LEVEL_DESIGN_SPAWN_ALIASES)], at);
            if (typeof group.group !== 'string' || !LEVEL_DESIGN_NAME_RE.test(group.group)) {
                warn(`${at} needs a "group" name, used to report spawn:<group> and defeated:<group>`);
            } else if (seenGroups.has(group.group)) {
                warn(`${at}: this state spawns "${group.group}" twice, so their reports cannot be told apart`);
            } else {
                seenGroups.add(group.group);
            }
            const { spec, def } = levelDesignSpawn(design, group);
            if (spec.type === undefined) warn(`${at} needs a "type"`);
            oneOf(group.type, V.values.spawnType, `${at} "type"`);
            spawnFields(group, at);
            if (typeof spec.from !== 'string') {
                warn(`${at} needs "from", the layer they come out of${def ? ', here or in its group' : ''}`);
            }
            if (!def || group.order !== undefined || group.pool !== undefined) orderNames(spec, at);
            // "inherit" brings back the members still standing from an earlier
            // spawn of the group: who they are is settled, so these keys are not.
            if (group.inherit === true) {
                for (const key of ['count', 'pick', 'pool', 'order'].filter(key => group[key] !== undefined)) {
                    warn(`${at} has "${key}", which "inherit" does not use: the members still standing come back`);
                }
                const firstSpawn = Object.values(states).some(other => (Array.isArray(other?.spawn) ? other.spawn : [])
                    .some(s => _levelDesignIsObject(s) && s.group === group.group && s.inherit !== true));
                if (!firstSpawn) warn(`${at} "inherit": no state spawns "${group.group}" first, so nobody can come back`);
            }
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
            if (step.on === undefined && step.when === undefined) warn(`${at} has no "on" or "when", so it never fires`);
            else if (step.on !== undefined) trigger(step.on, `${at} "on"`);
            if (step.when !== undefined) {
                if (!_levelDesignIsObject(step.when) || !Object.keys(step.when).length) {
                    warn(`${at} "when" should be an object of case names and true or false, such as { "has-key": true }`);
                } else {
                    for (const [caseName, value] of Object.entries(step.when)) {
                        if (!(caseName in cases)) {
                            warn(`${at} "when" reads case "${caseName}", which is not in "cases"`
                               + _levelDesignDidYouMean(caseName, Object.keys(cases)));
                        }
                        if (typeof value !== 'boolean') warn(`${at} "when" "${caseName}" should be true or false`);
                    }
                }
            }
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
    const design = { version: 1, start: order[0] };
    if (_levelDesignIsObject(draft.groups)) {
        design.groups = {};
        for (const [type, defs] of Object.entries(draft.groups)) {
            design.groups[type] = _levelDesignIsObject(defs)
                ? Object.fromEntries(Object.entries(defs).map(([name, def]) =>
                    [name, _levelDesignDraftSpawn(def, `group "${name}"`, note)]))
                : defs;
        }
    }
    design.cases = {};
    design.states = {};

    // Cases, with their starting values from the first state.
    const draftCases = Object.fromEntries(levelDesignCaseEntries(draft.cases).map(entry => [entry.name, entry]));
    const caseNames = Array.isArray(draft.case) ? draft.case
                    : Array.isArray(draft.cases) ? draft.cases
                    : Object.keys(draftCases);
    const firstSet = stateSource[order[0]]?.['set-case'] || stateSource[order[0]]?.set || {};
    for (const name of caseNames.filter(name => typeof name === 'string')) {
        const entry = draftCases[name];
        if (entry?.condition) {
            design.cases[name] = { condition: entry.condition };
            if (entry.shorthand) note(`case "${name}" is written ${JSON.stringify(design.cases[name])}`);
        } else {
            design.cases[name] = typeof entry?.value === 'boolean' ? entry.value : firstSet[name] === true;
        }
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
        if (_levelDesignIsObject(src.cases)) {
            state.cases = {};
            for (const entry of levelDesignCaseEntries(src.cases)) {
                if (!entry.condition) continue;
                state.cases[entry.name] = { condition: entry.condition };
                if (entry.shorthand) note(`${where} case "${entry.name}" is written ${JSON.stringify(state.cases[entry.name])}`);
                if (!(entry.name in design.cases)) {
                    design.cases[entry.name] = false;
                    note(`${where} gives case "${entry.name}" a condition, but "cases" does not list it; it is added, starting false`);
                }
            }
        }
        if (src.reset !== undefined) state.reset = src.reset;

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
            else if (enemySrc.timeout !== undefined) group.timeout = enemySrc.timeout;
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
            state.spawn = state.spawn.map((group, i) => _levelDesignDraftSpawn(group,
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

// _levelDesignDraftSpawn - a draft spawn group (or a group under "groups") as
// version 1 writes it: a "pick" that lists enemies becomes the "pool" (when
// there is none) with "pick": "random"; "timeout" becomes "every"; a time
// written as text ("1s") becomes seconds; each shorthand entry,
// "Name:render([part.background(palette), ...])", becomes { enemy, render };
// and an entry that names its enemy as an object is written flat.
function _levelDesignDraftSpawn(group, where, note) {
    if (!_levelDesignIsObject(group)) return group;
    const out = { ...group };
    if (Array.isArray(out.pick)) {
        if (!Array.isArray(out.pool)) out.pool = out.pick;
        note(`${where}: "pick" lists enemies; version 1 lists them in "pool", with "pick": "random"`);
        out.pick = 'random';
    }
    for (const [alias, key] of Object.entries(LEVEL_DESIGN_SPAWN_ALIASES)) {
        if (out[alias] === undefined) continue;
        if (out[key] === undefined) {
            out[key] = out[alias];
            note(`${where}: "${alias}" is "${key}" in version 1`);
        } else {
            note(`${where}: "${alias}" is left out, since "${key}" is given`);
        }
        delete out[alias];
    }
    for (const key of ['after', 'every']) {
        if (typeof out[key] !== 'string') continue;
        const value = levelDesignSeconds(out[key]);
        if (value === null) continue;
        note(`${where} "${key}": "${out[key]}" is written ${value}`);
        out[key] = value;
    }
    if (Array.isArray(out.pool)) {
        out.pool = out.pool.map(entry => {
            const read = typeof entry === 'string' ? levelDesignShorthandEnemy(entry) : null;
            if (read) {
                note(`${where} "pool": "${entry}" is written ${JSON.stringify(read)}`);
                return read;
            }
            if (_levelDesignIsObject(entry) && _levelDesignIsObject(entry.enemy)) {
                const flat = _levelDesignFlatPoolEntry(entry);
                note(`${where} "pool": an entry that names its enemy as an object is written flat, ${JSON.stringify(flat)}`);
                return flat;
            }
            return entry;
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

// levelDesignEnemyVariants - every enemy a version 1 design's pools ask to
// have drawn differently, as [{ enemy, render }], one per enemy and render:
// the pool entries written { "enemy": ..., "render": { ... } }, in the
// states' spawns and in "groups", leaving out an entry whose "re-render" is 0.
// What the level registers (enemyVariant) and waits on before it starts, so
// a variant's first frame is never blank. Entries that are not that shape are
// left to the checks.
function levelDesignEnemyVariants(design) {
    const pools = [];
    for (const defs of _levelDesignIsObject(design?.groups) ? Object.values(design.groups) : []) {
        for (const def of _levelDesignIsObject(defs) ? Object.values(defs) : []) {
            if (_levelDesignIsObject(def) && Array.isArray(def.pool)) pools.push(def.pool);
        }
    }
    for (const state of _levelDesignIsObject(design?.states) ? Object.values(design.states) : []) {
        for (const group of _levelDesignIsObject(state) && Array.isArray(state.spawn) ? state.spawn : []) {
            if (_levelDesignIsObject(group) && Array.isArray(group.pool)) pools.push(group.pool);
        }
    }
    const found = new Map();
    for (const raw of pools.flat()) {
        const entry = levelDesignPoolEntry(raw);
        if (!entry?.render || !entry.reRender) continue;
        const key = `${entry.enemy.toLowerCase()}|${typeof variantRenderKey === 'function'
            ? variantRenderKey(entry.render) : JSON.stringify(entry.render)}`;
        if (!found.has(key)) found.set(key, { enemy: entry.enemy, render: { ...entry.render } });
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
// right, then further left and right, as a share of each one's width. A sixth
// and on stand a row deeper, so a crew that comes out all at once ("order":
// "same") does not stand on itself.
const LEVEL_DESIGN_SPAWN_LANES = [0, -1, 1, -2, 2];
const LEVEL_DESIGN_SPAWN_LANE_W = 0.75;
const LEVEL_DESIGN_SPAWN_ROW    = 40;
// Coming in from the view's edges ("from": "edges"): how far inside the view
// the first pair stops, how much further each next pair, and how far apart in
// depth their lanes are.
const LEVEL_DESIGN_EDGE_INSET      = 60;
const LEVEL_DESIGN_EDGE_STEP       = 40;
const LEVEL_DESIGN_EDGE_LANE_DEPTH = 24;

// levelDesignNearerSide - the edge of the view nearer an enemy: -1 for the
// left, 1 for the right.
function levelDesignNearerSide(enemy) {
    return enemy.x + enemy.w * 0.5 < cam.x + W * 0.5 ? -1 : 1;
}

// levelDesignOffView - just past one edge of the view for an enemy, at its
// own depth, as the hit box's top-left: where it goes to leave, or waits.
function levelDesignOffView(enemy, side) {
    return { x: side < 0 ? cam.x - enemy.w - 8 : cam.x + W + 8, y: enemy.y };
}

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
    if (_levelDesignIsObject(entry) && _levelDesignIsObject(entry.enemy)) entry = _levelDesignFlatPoolEntry(entry);
    if (!_levelDesignIsObject(entry) || typeof entry.enemy !== 'string') return null;
    const render = _levelDesignIsObject(entry.render) ? entry.render : {};
    return Object.keys(render).length && typeof enemyVariant === 'function'
        ? enemyVariant(entry.enemy, render)
        : enemyDefId(entry.enemy);
}

// _levelDesignFlatPoolEntry - a pool entry that names its enemy as an object,
// { "enemy": { "name": "SassyGirl", "count": 2, ... } }, written flat:
// { "enemy": "SassyGirl", "count": 2, ... }. Keys beside "enemy" win.
function _levelDesignFlatPoolEntry(entry) {
    const { enemy, ...rest } = entry;
    const { name, ...inner } = _levelDesignIsObject(enemy) ? enemy : {};
    return { enemy: name, ...inner, ...rest };
}

// levelDesignPoolEntry - a pool entry read as { enemy, render, count,
// reRender, name }: a name is one of that enemy, an object brings "count" of
// it (default 1), the first "re-render" of them (default all) drawn with its
// "render". Null when the entry is neither, the shorthand string included.
function levelDesignPoolEntry(entry) {
    if (typeof entry === 'string') {
        return entry.trim() && !levelDesignShorthandEnemy(entry)
            ? { enemy: entry.trim(), render: null, count: 1, reRender: 0, name: null } : null;
    }
    if (!_levelDesignIsObject(entry)) return null;
    const flat = _levelDesignIsObject(entry.enemy) ? _levelDesignFlatPoolEntry(entry) : entry;
    if (typeof flat.enemy !== 'string' || !flat.enemy.trim()) return null;
    const render = _levelDesignIsObject(flat.render) && Object.keys(flat.render).length ? flat.render : null;
    const count = Number.isInteger(flat.count) && flat.count >= 1 ? flat.count : 1;
    const asked = flat['re-render'];
    const reRender = !render ? 0 : Number.isInteger(asked) && asked >= 0 ? Math.min(asked, count) : count;
    const name = typeof flat.name === 'string' && LEVEL_DESIGN_NAME_RE.test(flat.name) ? flat.name : null;
    return { enemy: flat.enemy.trim(), render, count, reRender, name };
}

// levelDesignPoolSlots - a pool as one slot per enemy it brings, in pool
// order: [{ index, entry, enemy, render, name }], where index is the slot's
// place in that order and entry the place of the pool entry it came from.
// { "enemy": "SassyGirl", "count": 2, "re-render": 1, "render": { ... } } is
// two slots, the recolored one first. Entries that are not enemies are left
// out; the checks name them.
function levelDesignPoolSlots(pool) {
    const slots = [];
    (Array.isArray(pool) ? pool : []).forEach((raw, entryIndex) => {
        const entry = levelDesignPoolEntry(raw);
        if (!entry) return;
        for (let n = 0; n < entry.count; n++) {
            slots.push({
                index: slots.length, entry: entryIndex, enemy: entry.enemy,
                render: n < entry.reRender ? entry.render : null, name: entry.name,
            });
        }
    });
    return slots;
}

// levelDesignSpawn - a state's spawn laid over the group it names under
// "groups", as { spec, def, type }: the spawn's own keys win, key by key, and
// a list ("pool", "order") is replaced whole, never merged. "type" may be
// left out when the group is filed under one type only. "timeout" is read as
// "every" on each side before they are laid together, so a spawn's "timeout"
// still wins over its group's "every". def is null for a spawn whose group is
// not under "groups", which is then read as written.
function levelDesignSpawn(design, spawn) {
    if (!_levelDesignIsObject(spawn)) return { spec: spawn, def: null, type: null };
    const groups = _levelDesignIsObject(design?.groups) ? design.groups : {};
    const filed = type => _levelDesignIsObject(groups[type]) && _levelDesignIsObject(groups[type][spawn.group]);
    let type = typeof spawn.type === 'string' ? spawn.type : null;
    if (!type && typeof spawn.group === 'string') {
        const types = Object.keys(groups).filter(filed);
        if (types.length === 1) type = types[0];
    }
    const def = type && typeof spawn.group === 'string' && filed(type) ? groups[type][spawn.group] : null;
    const spec = { ..._levelDesignReadAliases(def || {}), ..._levelDesignReadAliases(spawn) };
    if (type) spec.type = type;
    return { spec, def, type };
}

// _levelDesignReadAliases - a spawn with its other spellings read as the
// key ("timeout" as "every", a time in text as seconds), without the alias.
function _levelDesignReadAliases(spec) {
    const out = { ...spec };
    for (const [alias, key] of Object.entries(LEVEL_DESIGN_SPAWN_ALIASES)) {
        if (out[alias] === undefined) continue;
        if (out[key] === undefined) {
            const value = levelDesignSeconds(out[alias]);
            out[key] = value !== null ? value : out[alias];
        }
        delete out[alias];
    }
    return out;
}

// _levelDesignOrderScore - how well a name in an "order" list matches a pool
// slot: 3 for the entry's own "name" or its pool position (from 1), 2 for the
// enemy drawn as itself, 1 for the enemy drawn with a render, 0 for none. So
// "CrimeGuy" takes a plain CrimeGuy before a gray one.
function _levelDesignOrderScore(slot, name) {
    if (Number.isInteger(name)) return slot.entry + 1 === name ? 3 : 0;
    const text = String(name ?? '').trim().toLowerCase();
    if (!text) return 0;
    if (slot.name && slot.name.toLowerCase() === text) return 3;
    const id = n => (typeof enemyDefId === 'function' && typeof ENEMY_DEFS !== 'undefined' ? enemyDefId(n) : null)
                 || String(n).trim().toLowerCase();
    if (slot.enemy && id(slot.enemy) === id(name)) return slot.render ? 1 : 2;
    return 0;
}

// _levelDesignOrderTake - take the slot a name matches best out of left
// (earliest first among equals) and return it, or null when none matches.
function _levelDesignOrderTake(left, name) {
    let best = -1;
    let bestScore = 0;
    left.forEach((slot, i) => {
        const score = _levelDesignOrderScore(slot, name);
        if (score > bestScore) {
            best = i;
            bestScore = score;
        }
    });
    return best < 0 ? null : left.splice(best, 1)[0];
}

// levelDesignOrderRoster - the members "pick" drew, in the order they come
// out: "random" shuffled, "sequence" in pool order, "reverse" the other way,
// a list by name first and the rest in pool order. "same" and "load" bring
// them all at once, and no order at all keeps the order "pick" drew them in
// (random for "random", the pool's for "in-order").
function levelDesignOrderRoster(drawn, order) {
    if (order === 'random') return _levelDesignShuffle(drawn);
    const byPool = [...drawn].sort((a, b) => a.index - b.index);
    if (order === 'sequence') return byPool;
    if (order === 'reverse') return byPool.reverse();
    if (Array.isArray(order)) {
        const named = [];
        for (const name of order) {
            const slot = _levelDesignOrderTake(byPool, name);
            if (slot) named.push(slot);
        }
        return [...named, ...byPool];
    }
    return [...drawn];
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
// fires whenever the condition holds while its state is current. A step's
// "when" adds cases that must have given values at that moment; a step with
// "when" and no "on" fires as soon as they do. A restricted "until" holds once
// its condition has been true at any point in the run, events included; with
// "type": "condition" the door is open only while it holds.
//
// A case either holds a value, changed by "set", or follows a condition
// ("alive = 0", "inventory:key"), worked out every frame: from the start when
// the top "cases" gives it one, from a state on when that state's "cases"
// does. A "set" stops a case following. A state's "reset" puts back what it
// lists ("break:<name>", "animate:<layer>", "unlock:<name>", "case:<name>"),
// or with "level" the whole run, then enters the start state again. Whatever
// can happen twice (a gate broken again, a group spawned again, a case
// turning true again) forgets its report first, so it is heard again.
//
// A state's "player" rules apply when the state is entered: "health" and
// "inventory" at once, and "spawn" as an entrance. The player is kept off
// stage for "after" seconds, then walks in from the left or right edge of the
// level (to the sandbox's spawn band, or its mirror on the right) or out of a
// layer, and "arrive:<state>" is reported when they get there. With "svg":
// "fade-out" the entrance starts while the screen is black. "inventory":
// "empty" empties what the player carries (player.inventory). "store" keeps
// the player's health and what they carry on director.carry for the next
// level to pick up.
//
// A state's "spawn" groups start when the state is entered, each laid over
// its definition under "groups" when it has one. The roster is drawn then:
// "pick" chooses from the pool, "order" sets who comes first ("same", or a
// door into the state, brings them all at once). Each member appears at the
// foot of the group's "from" layer (or just off the view's edges, for
// "edges") and walks into the field, one every "every" seconds after the
// first "after". "inherit" brings back the last spawn's members still
// standing instead, with their health; "then": "flee" has them stand a moment
// and run off. A group only spawns while the player is in the scene its layer
// is in; inside a building, its timer waits. "spawn:<group>" is reported when
// the first one appears, "defeated:<group>" once all of them have appeared
// and are gone, or "fled:<group>" when any of them ran off.
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
        this.carry    = null;           // what "store" kept for the next level
        // options.onStart  called each time the start state has been entered:
        //                  the sandbox gives its test's items then, after the
        //                  design's "inventory" rules, so they are not emptied.
        this.onStart  = typeof options.onStart === 'function' ? options.onStart : null;
        this.states   = _levelDesignIsObject(design?.states) ? design.states : {};
        // Each case's starting value, and the top-level conditions some follow
        // from the start; "reset" goes back to these. A condition case starts
        // false and is worked out on the first update.
        this.caseStart = {};
        this.caseRules = {};
        for (const entry of levelDesignCaseEntries(design?.cases)) {
            if (typeof entry.value === 'boolean') this.caseStart[entry.name] = entry.value;
            const rule = entry.condition !== null ? levelDesignCondition(entry.condition) : null;
            if (rule) {
                this.caseStart[entry.name] = false;
                this.caseRules[entry.name] = rule;
            }
        }
        this.cases      = { ...this.caseStart };
        this.conditions = { ...this.caseRules };   // case name -> the condition it follows now
        this.plannedTotals = new Map();         // group -> how many its first spawn brings
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
        // Conditions first, so a step that fires on an event this frame reads
        // the level as it is now.
        this._updateConditions();
        if (!this.started) {
            this.started = true;
            for (const [name, value] of Object.entries(this.cases)) {
                if (value) this._report('case', name);
            }
            if (this.states[this.design.start]) this._enter(this.design.start);
            else this.notify(`start state "${this.design?.start}" is not in "states", so the design does nothing`);
            if (this.onStart) this.onStart(this);
        }

        while (this.queue.length) {
            const event = this.queue.shift();
            this.heard.add(event);
            this._follow(step => step.on === event);
        }
        // Each move can make another state's condition true; follow them until
        // the level settles or the per-frame limit is reached. A step with
        // "when" and no "on" is a condition of its own.
        while (this._follow(step => (step.on === undefined
            ? _levelDesignIsObject(step.when)
            : this._isCondition(step.on) && this._holds(step.on)))) { /* keep moving */ }
        this._updateEntrance();
        this._updateGroups();
        this._updateLayerMoves();
        // Again before the locks, which read cases: a state entered this frame
        // may have started groups that change them.
        this._updateConditions();
        this._openLocks();
    }

    // snapshot - where the design is, for the debug overlay and for tests.
    snapshot() {
        return {
            state:  this.state,
            cases:  { ...this.cases },
            conditions: Object.fromEntries(Object.entries(this.conditions).map(([name, rule]) => [name, rule.text])),
            locked: this.runtime ? this.runtime.restrictedEntries()
                .filter(entry => this.runtime.isLocked(entry.name)).map(entry => entry.name) : [],
            entrance: this.entrance
                ? `${this.entrance.state}: ${this.entrance.walking ? 'walking in' : 'waiting'}` : null,
            carry: this.carry ? { ...this.carry } : null,
            inventory: this._player()?.inventory?.entries() || [],
            groups: [...this.groups.values()].map(group => ({
                name:     group.name,
                total:    group.total,
                spawned:  group.spawned,
                down:     group.enemies.filter(enemy => enemy.dead).length,
                standing: group.enemies.filter(enemy => !enemy.dead && !enemy.fled).length,
                toCome:   group.total - group.spawned,
                fled:     group.enemies.filter(enemy => enemy.fled).length,
                ids:      group.enemies.map(enemy => enemy.typeId),
                order:    group.order,
                queue:    group.queue.map(slot => slot.id),
            })),
        };
    }

    // ── States ────────────────────────────────────────────────────────────────
    // _follow - take the first of the current state's "next" steps that
    // matches, and whose "when" cases all have their values now. Returns
    // whether the level moved.
    _follow(matches) {
        const steps = this.states[this.state]?.next;
        if (!Array.isArray(steps)) return false;
        const step = steps.find(s => _levelDesignIsObject(s) && matches(s) && this._whenHolds(s.when) && this.states[s.to]);
        if (!step) return false;
        if (++this.stepsThisFrame > LEVEL_DESIGN_MAX_STEPS) {
            if (!this.loopReported) {
                this.loopReported = true;
                this.notify(`states keep moving on from each other in one frame (last: "${this.state}" to `
                          + `"${step.to}"); stopped at "${this.state}". Check their "case:" and "state:" triggers`);
            }
            return false;
        }
        this._enter(step.to, step.on);
        return true;
    }

    // via is the trigger of the step that led here: a state entered through a
    // door ("enter:", "exit:") brings its spawn groups in all at once unless
    // they say otherwise, since the scene is new to the player either way.
    //
    // A state's "reset" runs first, so what it puts back is there for the
    // state's own "set" and spawns; with "svg": "fade-out" it waits for the
    // screen to be black instead. "reset": "level" starts the level over, and
    // the rest of the state is not used.
    _enter(name, via = null) {
        this.state = name;
        this.visited.add(name);
        const state = this.states[name] || {};
        const viaKind = levelDesignTrigger(via)?.kind;
        const fades = state.svg === 'fade-out' && !!this.runtime;
        this._report('state', name);
        if (state.reset !== undefined && !fades) {
            if (state.reset === LEVEL_DESIGN_VOCAB.values.resetAll) {
                this._resetLevel();
                return;
            }
            this._reset(state.reset);
        }
        this._applySet(state.set);
        // Groups before the state's conditions, so a crew about to come out
        // already counts: "alive = 0" is never true for the frame between.
        this._startGroups(state.spawn, viaKind === 'enter' || viaKind === 'exit');
        this._applyCaseRules(state.cases);
        this._startLayerMoves(state['animate-layers'], name);
        this._applyPlayerStats(state.player, name);

        const rules = _levelDesignIsObject(state.player) ? state.player : null;
        if (fades) {
            this.runtime.fadeThrough(this._player(), () => {
                if (state.reset === LEVEL_DESIGN_VOCAB.values.resetAll) {
                    this._resetLevel();
                    return;
                }
                if (state.reset !== undefined) this._reset(state.reset);
                this._startEntrance(rules, name);
            });
        } else {
            this._startEntrance(rules, name);
        }
    }

    // ── Player ────────────────────────────────────────────────────────────────
    // _applyPlayerStats - "health" and "inventory", at once on entering.
    // "empty" empties what the player carries, "inherit" keeps it, and
    // "store" keeps it and copies it onto carry for the next level.
    _applyPlayerStats(rules, stateName) {
        const p = this._player();
        if (!_levelDesignIsObject(rules) || !p) return;
        if (rules.health === 'full') {
            p.hp = p.maxHp;
            if (typeof _hpHUD === 'function') _hpHUD(p);
        }
        if (rules.inventory === 'empty') p.inventory?.clear();
        if (rules.health === 'store' || rules.inventory === 'store') {
            this.carry = {
                from:      stateName,
                health:    rules.health === 'store' ? p.hp : this.carry?.health ?? null,
                maxHealth: p.maxHp,
                inventory: rules.inventory === 'store' ? (p.inventory?.entries() || []) : this.carry?.inventory ?? null,
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

    // ── Cases ─────────────────────────────────────────────────────────────────
    // _setCase - give a case a value. Turning true reports "case:<name>";
    // turning false forgets that report, so turning true again reports again.
    _setCase(name, value) {
        const was = this.cases[name] === true;
        this.cases[name] = value;
        if (value && !was) this._report('case', name);
        else if (!value && was) this._forget(`case:${name}`);
    }

    // _applySet - a state's "set". A case that was following a condition
    // stops following it and keeps the value given.
    _applySet(set) {
        if (!_levelDesignIsObject(set)) return;
        for (const [name, value] of Object.entries(set)) {
            if (typeof value !== 'boolean') continue;
            delete this.conditions[name];
            this._setCase(name, value);
        }
    }

    // _applyCaseRules - a state's "cases": from here on, each named case
    // follows its condition, worked out at once.
    _applyCaseRules(cases) {
        let changed = false;
        for (const entry of levelDesignCaseEntries(cases)) {
            const rule = entry.condition !== null ? levelDesignCondition(entry.condition) : null;
            if (!rule) continue;
            this.conditions[entry.name] = rule;
            changed = true;
        }
        if (changed) this._updateConditions();
    }

    // _updateConditions - every case that follows a condition, as it is now.
    _updateConditions() {
        for (const [name, rule] of Object.entries(this.conditions)) {
            this._setCase(name, this._conditionHolds(rule));
        }
    }

    _conditionHolds(rule) {
        const flag = LEVEL_DESIGN_VOCAB.conditions.flag.includes(rule.source);
        const n = this._conditionCount(rule);
        return flag && !rule.op ? n === 1 : levelDesignCompare(n, rule.op, rule.value);
    }

    // _conditionCount - the number a condition compares: a count, or 1 or 0
    // for a flag.
    _conditionCount(rule) {
        switch (rule.source) {
            case 'alive':     return rule.name ? this._aliveIn(rule.name) : this._aliveAll();
            case 'fled':      return this.groups.get(rule.name)?.enemies.filter(enemy => enemy.fled).length || 0;
            case 'inventory': {
                const bag = this._player()?.inventory;
                if (!bag || typeof bag.count !== 'function') return 0;
                return rule.name ? bag.count(rule.name) : bag.total();
            }
            case 'case':      return this.cases[rule.name] === true ? 1 : 0;
            case 'state':     return this.visited.has(rule.name) ? 1 : 0;
            default:          return 0;
        }
    }

    // _aliveIn - a group's members still to beat: before it has started, all
    // that its first spawn would bring; then those still to come out plus
    // those standing. Members that ran off are not counted.
    _aliveIn(name) {
        const group = this.groups.get(name);
        if (!group) return this._plannedTotal(name);
        return group.total - group.spawned
             + group.enemies.filter(enemy => !enemy.dead && !enemy.fled).length;
    }

    // _aliveAll - enemies in play: standing in any scene of the run (the one
    // the player is in, and the street kept while they are inside), plus the
    // members of started groups still to come out. A group that has not
    // started is not in play, so a crew for later never keeps a door shut.
    _aliveAll() {
        const lists = [typeof enemies !== 'undefined' ? enemies : [],
                       ...(this.runtime ? this.runtime.stack.map(frame => frame.enemies || []) : [])];
        let n = 0;
        for (const list of lists) n += list.filter(enemy => !enemy.dead && !enemy.fled).length;
        for (const group of this.groups.values()) n += group.total - group.spawned;
        return n;
    }

    // _plannedTotal - how many a group's first spawn in the design brings,
    // for a group that has not started yet.
    _plannedTotal(name) {
        if (!this.plannedTotals.has(name)) {
            let total = 0;
            for (const state of Object.values(this.states)) {
                const raw = (Array.isArray(state?.spawn) ? state.spawn : [])
                    .find(spawn => _levelDesignIsObject(spawn) && spawn.group === name && spawn.inherit !== true);
                if (!raw) continue;
                const { spec } = levelDesignSpawn(this.design, raw);
                total = Number.isInteger(spec.count) && spec.count >= 1 ? spec.count
                      : Array.isArray(spec.pool) ? levelDesignPoolSlots(spec.pool).length : 1;
                break;
            }
            this.plannedTotals.set(name, total);
        }
        return this.plannedTotals.get(name);
    }

    // _whenHolds - a step's "when": every case named has the value given.
    _whenHolds(when) {
        if (when === undefined) return true;
        if (!_levelDesignIsObject(when)) return false;
        return Object.entries(when).every(([name, value]) => (this.cases[name] === true) === value);
    }

    // ── Reset ─────────────────────────────────────────────────────────────────
    // _reset - a state's "reset" list: each thing put back as it was at the
    // start of the run, and able to report again.
    _reset(list) {
        for (const item of Array.isArray(list) ? list : []) {
            const parsed = levelDesignTrigger(item);
            if (!parsed) continue;
            const { kind, key } = parsed;
            if (kind === 'break') {
                if (this.runtime && !this.runtime.resetBreakable(key)) this.notify(`"reset": there is no breakable "${key}" to mend`);
            } else if (kind === 'animate') {
                if (this.runtime && !this.runtime.resetLayer(key)) this.notify(`"reset": no scene moves a layer "${key}"`);
            } else if (kind === 'unlock') {
                this.runtime?.lock(key);
            } else if (kind === 'case') {
                if (this.caseRules[key]) this.conditions[key] = this.caseRules[key];
                else delete this.conditions[key];
                this._setCase(key, this.caseStart[key] === true);
                this._updateConditions();
            }
            this._forget(item);
        }
    }

    // _resetLevel - "reset": "level". The run as it started: the level map
    // put back (runtime.resetRun), every case at its starting value and
    // following its starting condition, no groups, nothing heard or visited,
    // then the start state entered, whose "player" rules settle the player's
    // health and inventory.
    _resetLevel() {
        const p = this._player();
        if (this.runtime) this.runtime.resetRun(p);
        else if (typeof enemies !== 'undefined') enemies.length = 0;
        if (this.entrance && p) {
            p.hidden = false;
            p.script = null;
        }
        this.entrance   = null;
        this.cases      = { ...this.caseStart };
        this.conditions = { ...this.caseRules };
        this.visited.clear();
        this.heard.clear();
        this.queue.length = 0;
        this.groups.clear();
        this.layerMoves.length = 0;
        // The start state first, whose "player" rules may empty what the
        // player carries: conditions read after it, so a case such as
        // "inventory:key" is never true for the moment between.
        if (this.states[this.design.start]) this._enter(this.design.start);
        if (this.onStart) this.onStart(this);
        this._updateConditions();
        for (const [name, value] of Object.entries(this.cases)) {
            if (value) this._report('case', name);
        }
    }

    // _forget - let reports be heard again: by the runtime, which sends each
    // once per run, and by this director's record of what it heard.
    _forget(...events) {
        if (this.runtime) this.runtime.forget(...events);
        for (const event of events) this.heard.delete(event);
    }

    // ── Spawn groups ──────────────────────────────────────────────────────────
    // _startGroups - set a state's spawn groups going, each laid over its
    // group under "groups" (levelDesignSpawn). The whole roster is drawn when
    // the group starts: "pick" chooses the members from the pool's slots (an
    // entry with "count" 2 is two), "order" sets when each comes out, and a
    // group with no "count" brings every slot in its pool. byDoor is whether
    // the state was entered through a door, which makes "same" the default
    // order. "from": "edges" brings them in from just off the view's sides
    // instead of out of a layer. "inherit" brings back the members of the
    // group's last spawn still standing, wherever they are, with their health,
    // instead of drawing new ones. A group starting forgets its old reports,
    // so it reports "spawn:", "defeated:" and "fled:" again. One that cannot
    // run (no such layer, no enemies to pick) says why once and is skipped; the
    // validator has usually said so already.
    _startGroups(list, byDoor = false) {
        for (const raw of Array.isArray(list) ? list : []) {
            if (!_levelDesignIsObject(raw) || typeof raw.group !== 'string') continue;
            const { spec } = levelDesignSpawn(this.design, raw);
            if (spec.type !== 'enemy') {
                this.notify(`spawn "${spec.group}": type "${spec.type}" is not built, so nobody comes`);
                continue;
            }
            const edges = LEVEL_DESIGN_VOCAB.values.spawnFrom.includes(spec.from);
            const place = edges ? { stage: this.runtime ? this.runtime.stage : this.stage, region: null }
                                : this._findLayer(spec.from);
            if (!place) {
                this.notify(`spawn "${spec.group}": there is no layer "${spec.from}" here, so nobody comes out`);
                continue;
            }
            const order = spec.order !== undefined ? spec.order : byDoor ? 'same' : null;
            let queue;
            if (spec.inherit === true) {
                const before = this.groups.get(spec.group);
                if (!before) this.notify(`spawn "${spec.group}": "inherit", but it has not been spawned yet, so nobody comes back`);
                const back = before ? before.enemies.filter(enemy => !enemy.dead && !enemy.fled) : [];
                back.forEach(enemy => this._takeOut(enemy));
                queue = back.map((member, index) => ({ index, entry: index, id: member.typeId, member }));
            } else {
                const slots = (Array.isArray(spec.pool)
                    ? levelDesignPoolSlots(spec.pool).map(slot => ({
                        ...slot, id: levelDesignEnemyId(slot.render ? { enemy: slot.enemy, render: slot.render } : slot.enemy),
                    }))
                    : levelDesignDefaultPool().map((id, index) => ({ index, entry: index, enemy: id, render: null, name: null, id })))
                    .filter(slot => slot.id);
                if (!slots.length) {
                    this.notify(`spawn "${spec.group}": its pool has no enemies, so nobody comes`);
                    continue;
                }
                const total = Number.isInteger(spec.count) && spec.count >= 1 ? spec.count
                            : Array.isArray(spec.pool) ? slots.length : 1;
                const pick = _levelDesignPicker(slots, spec.pick);
                queue = levelDesignOrderRoster(Array.from({ length: total }, pick), order);
            }
            const together = order === 'same' || order === 'load';
            const seconds = value => (typeof value === 'number' && value >= 0 ? value : 0);
            this._forget(`spawn:${spec.group}`, `defeated:${spec.group}`, `fled:${spec.group}`);
            this.groups.set(spec.group, {
                name:     spec.group,
                stage:    place.stage,
                edges,
                rect:     edges ? null : place.region.world,
                gap:      edges ? 0 : levelFieldGapBelow(place.stage, place.region.world),
                total:    queue.length,
                walk:     spec.animation !== 'idle',
                flee:     spec.then === 'flee',
                order:    spec.inherit === true ? 'inherit' : Array.isArray(order) ? 'list' : order || 'as picked',
                queue,
                nextAt:   this.time + seconds(spec.after),
                every:    together ? 0 : seconds(spec.every),
                spawned:  0,
                enemies:  [],
                finished: false,
            });
        }
    }

    // _takeOut - an enemy off every list it is on: the scene the player is
    // in, and the street kept while they are inside.
    _takeOut(enemy) {
        const lists = [typeof enemies !== 'undefined' ? enemies : null,
                       ...(this.runtime ? this.runtime.stack.map(frame => frame.enemies) : [])];
        for (const list of lists) {
            const i = Array.isArray(list) ? list.indexOf(enemy) : -1;
            if (i >= 0) list.splice(i, 1);
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
            // Finished once every member has come out and is gone: beaten and
            // faded, or run off. "fled:" when any of them ran.
            if (!group.finished && group.spawned === group.total
                && group.enemies.every(enemy => enemy.isDone)) {
                group.finished = true;
                this._report(group.enemies.some(enemy => enemy.fled) ? 'fled' : 'defeated', group.name);
            }
        }
    }

    // _spawnOne - the next member of a group: new, or one coming back
    // ("inherit") with the health it had. It walks in to a place in the field,
    // and a "then": "flee" group's members stand a moment there and run off.
    _spawnOne(group) {
        const i    = group.spawned;
        const slot = group.queue[i];
        const def  = ENEMY_DEFS[slot.id];
        const path = group.edges ? this._edgePath(group, i, def) : this._doorPath(group, i, def);

        let enemy = slot.member;
        if (enemy) {
            // Whatever it was doing is over; only its health and looks stay.
            enemy.script = null;
            enemy.scripts.length = 0;
            enemy.strike = null;
            enemy.vx = enemy.vy = 0;
            if (typeof enemy.setState === 'function' && enemy.state !== 'idle') enemy.setState('idle');
            enemy.x = path.from.x;
            enemy.y = path.from.y;
        } else {
            enemy = new Enemy(path.from.x, path.from.y, slot.id);
            enemy.spawnGroup = group.name;
            enemy.flankDir   = i % 2 === 0 ? 1 : -1;
        }
        if (group.walk) {
            enemy.walkTo(path.to.x, path.to.y, enemy.speed * CFG.enemySpeedMultiplier);
        } else {
            enemy.x = path.to.x;
            enemy.y = path.to.y;
            enemy.clampToStageField();
        }
        if (group.flee) this._sendOff(enemy);

        enemies.push(enemy);
        group.enemies.push(enemy);
        group.spawned++;
        if (group.spawned === 1) this._report('spawn', group.name);
    }

    // _doorPath - out of the foot of the group's layer, down to a place in
    // the field beside the ones before: past the gap between the layer and
    // the field (levelFieldGapBelow) and past the depth a door reaches, so
    // nobody stands in the doorway. Both as the hit box's top-left.
    _doorPath(group, i, def) {
        const door = group.rect;
        const footX = door.x + door.w * 0.5;
        const footY = door.y + door.h;
        const lanes = LEVEL_DESIGN_SPAWN_LANES.length;
        const lane = LEVEL_DESIGN_SPAWN_LANES[i % lanes];
        const target = _levelDesignFieldPoint(group.stage, {
            x: footX + lane * def.w * LEVEL_DESIGN_SPAWN_LANE_W,
            y: footY + group.gap + CFG.enterDepthTol + LEVEL_DESIGN_SPAWN_STEP_OUT
             + Math.floor(i / lanes) * LEVEL_DESIGN_SPAWN_ROW,
        });
        return {
            from: { x: footX - def.w * 0.5, y: footY - def.h },
            to:   { x: target.x - def.w * 0.5, y: target.y - def.h },
        };
    }

    // _edgePath - from just off the view's left edge, then its right, taking
    // turns, walking in to a place 60 to 140 px inside the view at the
    // player's depth, give or take a lane, so a crew closes in from both sides.
    _edgePath(group, i, def) {
        const side = i % 2 === 0 ? -1 : 1;
        const pair = Math.floor(i / 2);
        const p = this._player();
        const feetY = p ? p.y + p.h : H * 0.8;
        const lane = LEVEL_DESIGN_SPAWN_LANES[pair % LEVEL_DESIGN_SPAWN_LANES.length];
        const inset = LEVEL_DESIGN_EDGE_INSET + (pair % 3) * LEVEL_DESIGN_EDGE_STEP;
        const feet = _levelDesignFieldPoint(group.stage, {
            x: side < 0 ? cam.x + inset : cam.x + W - inset,
            y: feetY + lane * LEVEL_DESIGN_EDGE_LANE_DEPTH,
        });
        return {
            from: { x: side < 0 ? cam.x - def.w - 8 : cam.x + W + 8, y: feet.y - def.h },
            to:   { x: feet.x - def.w * 0.5, y: feet.y - def.h },
        };
    }

    // _sendOff - a member of a "then": "flee" group, once out: it stands for
    // CFG.enemyFleeDelay, runs off the nearer edge of the view (faster than it
    // walks, facing the way it runs), and is gone.
    _sendOff(enemy) {
        enemy.fleeing = true;
        enemy.queueScript({ wait: CFG.enemyFleeDelay });
        enemy.queueScript({
            walk:  e => levelDesignOffView(e, levelDesignNearerSide(e)),
            speed: enemy.speed * CFG.enemySpeedMultiplier * CFG.enemyFleeSpeed,
            face:  'travel',
        });
        enemy.queueScript({ leave: true });
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
    //
    // An entry with "type": "condition" is open only while its "until" holds:
    // it locks again when that stops (runtime.lock, "lock:<name>").
    _openLocks() {
        if (!this.runtime) return;
        const restricted = _levelDesignIsObject(this.design.restricted) ? this.design.restricted : {};
        for (const entry of this.runtime.restrictedEntries()) {
            const rule = _levelDesignIsObject(restricted[entry.name]) ? restricted[entry.name] : {};
            const follows = rule.type === 'condition';
            const locked = this.runtime.isLocked(entry.name);
            if (!locked && !follows) continue;
            const open = rule.until !== undefined
                ? this._holds(rule.until)
                : entry.requires.length > 0 && entry.requires.every(req =>
                    req.type === 'case'  ? this.cases[req.name] === true
                  : req.type === 'state' ? this.visited.has(req.name)
                  : req.type === 'item'  ? !!this._player()?.inventory?.has(req.name)
                  : false);
            if (locked && open) this.runtime.unlock(entry.name);
            else if (!locked && follows && !open) this.runtime.lock(entry.name);
        }
    }

    // Through the runtime, so each report goes out once per run; straight to
    // the bus when there is no runtime.
    _report(kind, key) {
        if (this.runtime) this.runtime.report(kind, key);
        else levelMapEmit(kind, key);
    }
}

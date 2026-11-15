// scripts/lib/levelMatrix.js - what every action the player can take does, in
// every state of a level design, worked out from the files: the action
// matrix of scripts/checkLevelDesign.js --matrix.
//
// It plays the design the way LevelDirector (js/level/level-design.js) does,
// over what the files can say instead of over time. A "node" is a state plus
// the facts that decide what happens there:
//
//   inside   the building the player is in, or null for the street
//   cases    each case's value, and the condition the ones that follow one
//            follow now (a state's "set" lets go of one, its "cases" takes
//            one up, "reset" puts it back)
//   groups   each spawn group: not started, out, beaten or ran off, whether
//            this spawn runs ("then": "flee"), and which scene it is in
//   broken   breakables broken; taken, items taken; has, items carried
//   fired    trigger areas already reported (once per run)
//   opened   locks that opened and stay open (not "type": "condition")
//   visited  states entered, for the ones a "state:" trigger names
//
// Every action possible at a node is tried: doors in and out, breaking,
// taking, trigger areas, interact areas, a group being beaten or running
// off, and whatever else a step waits on. Its effect is applied first (a
// door's way out puts the player outside, a take puts the item in hand), as
// the game does before the director hears the event, then the state's steps
// for that event are followed in order, as _follow takes the first that
// fires. Steps on a condition fire on their own as soon as they hold.
//
// What the files cannot settle is "maybe" (a number between 0 and 1 below),
// and both outcomes are followed: a count the design does not fix, an
// "until" that waits on an event nobody tracks. Timing is not modelled at
// all: bodies, fades, "after" and "every" are SANDBOX TEST's to check.
//
// The result lists, per state, what each action does, and the gaps:
//
//   1 did something, does nothing now: an action that moved the level on to
//     a state where the same action, still possible, does nothing
//   2 no way on: a state whose steps can never fire
//   3 never entered: a state nothing leads to
//   4 never fires: a step whose event cannot happen there, or whose "when"
//     never holds there
//   5 (a note) a door that opens in one state while only the state after it
//     has a step for going through it
//
// A gap the level's brief lists under "Nothing on purpose" is reported as
// meant, not as a gap.

'use strict';

const YES = 1;
const NO = 0;
const MAYBE = 0.5;
const and = (...values) => Math.min(...values);
const not = value => 1 - value;

const MAX_NODES = 20000;

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

// A count the files bound, as [lo, hi], against "<op> <value>". No op is "at
// least 1", as levelDesignCompare reads it.
function compareRange([lo, hi], op, value) {
    switch (op) {
        case '=':  return lo === hi && lo === value ? YES : value < lo || value > hi ? NO : MAYBE;
        case '!=': return lo === hi && lo === value ? NO : value < lo || value > hi ? YES : MAYBE;
        case '<':  return hi < value ? YES : lo >= value ? NO : MAYBE;
        case '<=': return hi <= value ? YES : lo > value ? NO : MAYBE;
        case '>':  return lo > value ? YES : hi <= value ? NO : MAYBE;
        case '>=': return lo >= value ? YES : hi < value ? NO : MAYBE;
        default:   return lo >= 1 ? YES : hi < 1 ? NO : MAYBE;
    }
}

const addRanges = ranges => ranges.reduce(([lo, hi], [a, b]) => [lo + a, hi + b], [0, 0]);

// Facts are plain objects with sorted keys and sorted lists, so two nodes
// with the same facts have the same key.
function sortedObject(obj) {
    return Object.fromEntries(Object.keys(obj).sort().map(key => [key, obj[key]]));
}

function factsKey(facts) {
    return JSON.stringify(facts);
}

function normalizeFacts(f) {
    return {
        s: f.s,
        inside: f.inside,
        cases: sortedObject(f.cases),
        rules: sortedObject(f.rules),
        groups: sortedObject(Object.fromEntries(Object.entries(f.groups).map(([name, g]) => [name, sortedObject(g)]))),
        broken: [...new Set(f.broken)].sort(),
        taken: [...new Set(f.taken)].sort(),
        has: sortedObject(f.has),
        fired: [...new Set(f.fired)].sort(),
        opened: [...new Set(f.opened)].sort(),
        visited: [...new Set(f.visited)].sort(),
    };
}

function cloneFacts(f) {
    return {
        s: f.s, inside: f.inside, cases: { ...f.cases }, rules: { ...f.rules },
        groups: Object.fromEntries(Object.entries(f.groups).map(([name, g]) => [name, { ...g }])),
        broken: [...f.broken], taken: [...f.taken], has: { ...f.has },
        fired: [...f.fired], opened: [...f.opened], visited: [...f.visited],
    };
}

// ── Reading the brief ─────────────────────────────────────────────────────────
// readOnPurpose - what a level brief lists under "## Nothing on purpose":
// each bullet's backticked names. A trigger ("exit:corner-shop") is an
// action, a state's name is a state: both together make the action meant to
// do nothing in that state, an action alone in every state, and a state
// alone means it is meant to be left behind (never entered, or an end).
function readOnPurpose(text, stateNames) {
    const out = { pairs: [], actions: [], states: [], lines: [] };
    if (typeof text !== 'string') return out;
    const section = /^##\s+Nothing on purpose\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im.exec(text);
    if (!section) return out;
    // A bullet runs on over the indented lines after it, up to a blank line.
    const bullets = [];
    for (const line of section[1].split(/\r?\n/)) {
        if (/^\s*[-*]\s+/.test(line)) bullets.push(line.trim());
        else if (/^\s+\S/.test(line) && bullets.length) bullets[bullets.length - 1] += ` ${line.trim()}`;
        else if (!line.trim()) bullets.push(null);
    }
    for (const line of bullets.filter(Boolean)) {
        const names = [...line.matchAll(/`([^`]+)`/g)].map(m => m[1].trim());
        const actions = names.filter(name => /^[a-z]+:[A-Za-z0-9][\w-]*$/.test(name));
        const states = names.filter(name => stateNames.includes(name));
        if (!actions.length && !states.length) continue;
        const said = line.replace(/^\s*[-*]\s+/, '').trim();
        out.lines.push(said);
        if (actions.length && states.length) {
            for (const action of actions) for (const state of states) out.pairs.push({ state, action, said });
        } else if (actions.length) {
            for (const action of actions) out.actions.push({ action, said });
        } else {
            for (const state of states) out.states.push({ state, said });
        }
    }
    return out;
}

// ── The matrix ────────────────────────────────────────────────────────────────
// buildMatrix - see the top of this file. input:
//   design          a version 1 design (prepareLevelDesign's)
//   street          the street's layers (checkLevelDesign's __levelLayers)
//   interiors       [{ name, path, art }] for each building
//   catalog         the item catalog's "items", or {}
//   startInventory  items the sandbox test hands over after the start state
//   onPurpose       readOnPurpose's result
//   api             the game's own readers: trigger, condition, spawn,
//                   caseEntries, poolSlots, vocab (LEVEL_DESIGN_VOCAB)
function buildMatrix(input) {
    const { design, street, interiors = [], catalog = {}, startInventory = [], api } = input;
    const onPurpose = input.onPurpose || readOnPurpose(null, []);
    const vocab = api.vocab;
    const states = isObject(design?.states) ? design.states : {};
    const stateNames = Object.keys(states);
    const start = design?.start;
    const resetAll = vocab.values?.resetAll || 'level';
    const conditionKinds = vocab.triggers.condition;
    const flagSources = vocab.conditions.flag;
    const stepsOf = name => (Array.isArray(states[name]?.next) ? states[name].next : [])
        .map((step, index) => ({ step, index })).filter(({ step }) => isObject(step));
    const isConditionStep = step => (step.on === undefined
        ? isObject(step.when)
        : conditionKinds.includes(api.trigger(step.on)?.kind));

    // Scenes: null is the street, a building's name its interior.
    const scenes = new Map([[null, street]]);
    for (const inside of interiors) if (inside.path && inside.art) scenes.set(inside.name, inside.art);
    const sceneName = scene => (scene === null ? 'the street' : scene);
    const where = new Map();   // "<kind>:<name>" -> scene
    for (const [scene, art] of scenes) {
        for (const piece of art.breakables) where.set(`break:${piece.name}`, scene);
        for (const item of art.items) where.set(`take:${item.name}`, scene);
        for (const area of art.events) where.set(`event:${area.name}`, scene);
        for (const object of art.objects) if (!object.holds.length) where.set(`interact:${object.name}`, scene);
    }
    const buildings = street.enterables
        .filter(entry => street.doors.some(door => door.into === entry.name && door.type === 'building'))
        .filter(entry => interiors.some(inside => inside.name === entry.name && inside.path))
        .map(entry => entry.name);

    // Groups, and how many each first spawn brings (as _plannedTotal does).
    const spawnsOf = name => (Array.isArray(states[name]?.spawn) ? states[name].spawn : [])
        .filter(raw => isObject(raw) && typeof raw.group === 'string')
        .map(raw => api.spawn(design, raw).spec)
        .filter(spec => spec && spec.type === 'enemy');
    const groupNames = [...new Set(stateNames.flatMap(name => spawnsOf(name).map(spec => spec.group)))];
    const plannedTotal = new Map();
    for (const group of groupNames) {
        let total = 1;
        for (const name of stateNames) {
            const spec = spawnsOf(name).find(s => s.group === group && s.inherit !== true);
            if (!spec) continue;
            total = Number.isInteger(spec.count) && spec.count >= 1 ? spec.count
                  : Array.isArray(spec.pool) ? api.poolSlots(spec.pool).length : 1;
            break;
        }
        plannedTotal.set(group, total);
    }
    const sceneOfLayer = path => {
        const last = String(path || '').split('/').pop().trim();
        const named = art => [...art.doors, ...art.breakables, ...art.items, ...art.events].some(entry =>
            new RegExp(`^${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-\\d+)?$`).test(entry.id))
            || art.objects.some(object => object.id === last) || art.enterables.some(entry => entry.id === last);
        if (named(street)) return null;
        for (const [scene, art] of scenes) if (scene !== null && named(art)) return scene;
        return null;
    };

    // Cases at the start, as the director's constructor reads them.
    const caseStart = {};
    const caseRules = {};
    for (const entry of api.caseEntries(design?.cases)) {
        if (typeof entry.value === 'boolean') caseStart[entry.name] = entry.value;
        if (entry.condition !== null && api.condition(entry.condition)) {
            caseStart[entry.name] = false;
            caseRules[entry.name] = entry.condition;
        }
    }

    // Items: every one the level holds, starts with, or names.
    const itemNames = new Set(startInventory);
    for (const art of scenes.values()) for (const item of art.items) itemNames.add(item.name);
    const conditionTexts = [...Object.values(caseRules)];
    for (const name of stateNames) {
        for (const entry of api.caseEntries(states[name]?.cases)) if (entry.condition) conditionTexts.push(entry.condition);
    }
    for (const text of conditionTexts) {
        const rule = api.condition(text);
        if (rule?.source === 'inventory' && rule.name) itemNames.add(rule.name);
    }
    for (const entry of street.enterables) {
        for (const req of entry.requires) if (req.startsWith('item:')) itemNames.add(req.slice(5));
    }
    const allSteps = stateNames.flatMap(name => stepsOf(name).map(({ step }) => step));
    for (const step of allSteps) {
        const t = api.trigger(step.on);
        if (t && vocab.itemTriggers.includes(t.kind)) itemNames.add(t.key);
    }
    // What the item screen can make, from items the level tracks: COMBINE is
    // always there for the player, named in a step or not.
    const combinations = [];
    for (const [a, def] of Object.entries(catalog)) {
        for (const [b, made] of Object.entries(isObject(def?.combine) ? def.combine : {})) {
            if (!combinations.some(c => c.made === made)) combinations.push({ a, b, made });
        }
    }
    for (const { a, b, made } of combinations) {
        if (itemNames.has(made) || (itemNames.has(a) && itemNames.has(b))) [a, b, made].forEach(id => itemNames.add(id));
    }

    // States a "state:" trigger names, the only ones whose visit is tracked.
    const stateTriggers = new Set();
    const noteState = text => {
        const t = api.trigger(text);
        if (t?.kind === 'state') stateTriggers.add(t.key);
    };
    allSteps.forEach(step => noteState(step.on));
    for (const rule of Object.values(isObject(design?.restricted) ? design.restricted : {})) noteState(rule?.until);
    for (const text of conditionTexts) {
        const rule = api.condition(text);
        if (rule?.source === 'state' && rule.name) stateTriggers.add(rule.name);
    }
    for (const entry of street.enterables) {
        for (const req of entry.requires) if (req.startsWith('state:')) stateTriggers.add(req.slice(6));
    }

    const lostWhy = (name, g) => `${name} were left in ${sceneName(g.scene)} when the player walked out: `
        + 'gone, but still counted (only "inherit" brings them back)';

    // ── Reading the facts ─────────────────────────────────────────────────────
    // A group's members still to beat. A crew lost in a building the player
    // walked out of is gone from every scene but still on its group's list:
    // "alive:<group>" counts it, "alive" (enemies in play) does not.
    const groupRange = (f, name, inPlay = false) => {
        const g = f.groups[name];
        if (!g || g.status === 'none') return [plannedTotal.get(name) || 0, plannedTotal.get(name) || 0];
        if (g.status === 'out' && g.lost) return inPlay ? [0, 0] : [1, Infinity];
        if (g.status === 'out') return [g.empty ? 0 : 1, Infinity];
        return [0, 0];
    };
    const itemRange = (f, name) => (f.has[name] === YES ? [1, Infinity] : f.has[name] === NO || f.has[name] === undefined ? [0, 0] : [0, Infinity]);

    function caseValue(f, name) {
        if (f.rules[name] !== undefined) return ruleValue(f, f.rules[name]);
        return f.cases[name] === true ? YES : NO;
    }

    function ruleValue(f, text) {
        const rule = api.condition(text);
        if (!rule) return NO;
        let range;
        switch (rule.source) {
            case 'alive':
                range = rule.name ? groupRange(f, rule.name)
                      : addRanges(Object.keys(f.groups).filter(name => f.groups[name].status !== 'none').map(name => groupRange(f, name, true)));
                break;
            case 'fled':
                range = f.groups[rule.name]?.status === 'fled' ? [1, Infinity] : [0, 0];
                break;
            case 'inventory':
                range = rule.name ? itemRange(f, rule.name) : addRanges([...itemNames].map(name => itemRange(f, name)));
                break;
            case 'case': {
                const v = caseValue(f, rule.name);
                range = v === YES ? [1, 1] : v === NO ? [0, 0] : [0, 1];
                break;
            }
            case 'state':
                range = stateTriggers.has(rule.name) ? (f.visited.includes(rule.name) ? [1, 1] : [0, 0]) : [0, 1];
                break;
            default:
                range = [0, 0];
        }
        return flagSources.includes(rule.source) && !rule.op ? compareRange(range, '=', 1) : compareRange(range, rule.op, rule.value);
    }

    function triggerValue(f, text) {
        const t = api.trigger(text);
        if (!t) return NO;
        if (t.kind === 'case') return caseValue(f, t.key);
        if (t.kind === 'state') return f.visited.includes(t.key) ? YES : stateTriggers.has(t.key) ? NO : MAYBE;
        if (t.kind === 'break') return f.broken.includes(t.key) ? YES : NO;
        return MAYBE;
    }

    function whenValue(f, when) {
        if (when === undefined) return YES;
        if (!isObject(when)) return NO;
        return and(YES, ...Object.entries(when).map(([name, value]) => (value === true ? caseValue(f, name) : not(caseValue(f, name)))));
    }

    // Whether a building's door lets the player in: its "restricted" entry,
    // else its REQUIRE- layers, else open unless it is a RESTRICTED.
    function openValue(f, building) {
        const rule = isObject(design?.restricted?.[building]) ? design.restricted[building] : null;
        if (rule && rule.until !== undefined) {
            if (rule.type === 'condition') return triggerValue(f, rule.until);
            return f.opened.includes(building) ? YES : triggerValue(f, rule.until);
        }
        const entry = street.enterables.find(e => e.name === building);
        if (!entry?.restricted) return YES;
        if (!entry.requires.length) return NO;
        // Opened by its REQUIRE- layers, a door stays open: only a
        // "type": "condition" entry locks again.
        if (f.opened.includes(building)) return YES;
        return and(YES, ...entry.requires.map(req => {
            const [type, name] = [req.slice(0, req.indexOf(':')), req.slice(req.indexOf(':') + 1)];
            if (type === 'case') return caseValue(f, name);
            if (type === 'state') return f.visited.includes(name) ? YES : NO;
            if (type === 'item') return f.has[name] === YES ? YES : f.has[name] === NO || f.has[name] === undefined ? NO : MAYBE;
            return NO;
        }));
    }

    // Locks that once open stay open (every lock but a "type": "condition"
    // entry, as LevelDirector._openLocks reads them), opened on the facts as
    // they stand.
    function settle(f) {
        for (const building of buildings) {
            if (f.opened.includes(building)) continue;
            const rule = isObject(design?.restricted?.[building]) ? design.restricted[building] : null;
            if (rule && rule.until !== undefined && rule.type === 'condition') continue;
            const entry = street.enterables.find(e => e.name === building);
            if (!entry?.restricted && !rule) continue;
            if (openValue(f, building) === YES) f.opened.push(building);
        }
        return normalizeFacts(f);
    }

    // ── Entering a state, as LevelDirector._enter does ─────────────────────────
    function baseFacts() {
        return {
            s: null, inside: null, cases: { ...caseStart }, rules: { ...caseRules },
            groups: Object.fromEntries(groupNames.map(name => [name, { status: 'none', flee: false, scene: null, empty: false, lost: false }])),
            broken: [], taken: [], has: Object.fromEntries([...itemNames].map(name => [name, NO])),
            fired: [], opened: [], visited: [],
        };
    }

    function startFacts(insideBefore = null) {
        const f = enterState(baseFacts(), start, 0);
        // The sandbox hands its test's items over once the start state has run.
        for (const item of startInventory) f.has[item] = YES;
        f.inside = f.inside ?? insideBefore ?? null;
        return settle(f);
    }

    function enterState(facts, name, depth) {
        const f = cloneFacts(facts);
        f.s = name;
        if (stateTriggers.has(name) && !f.visited.includes(name)) f.visited.push(name);
        const state = isObject(states[name]) ? states[name] : {};
        if (state.reset === resetAll) {
            // The run as it started, out in the street: "reset": "level".
            if (depth > 4) return settle(f);
            const fresh = startFacts();
            fresh.restarted = true;
            return fresh;
        }
        for (const item of Array.isArray(state.reset) ? state.reset : []) {
            const t = api.trigger(item);
            if (!t) continue;
            if (t.kind === 'break') f.broken = f.broken.filter(b => b !== t.key);
            else if (t.kind === 'unlock') f.opened = f.opened.filter(b => b !== t.key);
            else if (t.kind === 'case') {
                if (caseRules[t.key] !== undefined) f.rules[t.key] = caseRules[t.key];
                else delete f.rules[t.key];
                f.cases[t.key] = caseStart[t.key] === true;
            } else if (t.kind === 'event') f.fired = f.fired.filter(e => e !== t.key);
        }
        if (isObject(state.set)) {
            for (const [caseName, value] of Object.entries(state.set)) {
                if (typeof value !== 'boolean') continue;
                delete f.rules[caseName];
                f.cases[caseName] = value;
            }
        }
        for (const spec of spawnsOf(name)) {
            const before = f.groups[spec.group] || { status: 'none' };
            const standing = before.status === 'out' && !before.empty;
            // "inherit" brings back members still on the list, lost ones too.
            f.groups[spec.group] = {
                status: 'out',
                flee: spec.then === 'flee',
                scene: spec.from === 'edges' ? f.inside : sceneOfLayer(spec.from),
                empty: spec.inherit === true && !standing,
                lost: false,
            };
        }
        for (const entry of api.caseEntries(state.cases)) {
            if (entry.condition !== null && api.condition(entry.condition)) f.rules[entry.name] = entry.condition;
        }
        if (isObject(state.player) && state.player.inventory === 'empty') {
            for (const item of Object.keys(f.has)) f.has[item] = NO;
        }
        return settle(f);
    }

    // ── What the player (and the level) can do at a node ───────────────────────
    // Each { event, label, value, why, effect }: value how possible it is,
    // why the reason when it is not, effect the facts after it.
    const named = new Set(allSteps.map(step => api.trigger(step.on)).filter(t => t && !conditionKinds.includes(t.kind)).map(t => t.text));
    const catalogName = id => (isObject(catalog[id]) && typeof catalog[id].name === 'string' ? catalog[id].name : id);
    const labelOf = event => {
        const t = api.trigger(event);
        if (!t) return event;
        switch (t.kind) {
            case 'enter':    return `into ${t.key}`;
            case 'exit':     return `out of ${t.key}`;
            case 'break':    return `break ${t.key}`;
            case 'take':     return `take the ${catalogName(t.key).toLowerCase()}`;
            case 'event':    return `step on ${t.key}`;
            case 'interact': return `use ${t.key}`;
            case 'defeated': return `${t.key} beaten`;
            case 'fled':     return `${t.key} ran off`;
            case 'spawn':    return `${t.key} appear`;
            case 'locked':   return `try the locked ${t.key}`;
            case 'look':     return `look at ${t.key}`;
            case 'talk':     return `talk to ${t.key}`;
            case 'use':      return `use the ${catalogName(t.key).toLowerCase()}`;
            case 'drop':     return `drop the ${catalogName(t.key).toLowerCase()}`;
            case 'combine':  return `make the ${catalogName(t.key).toLowerCase()}`;
            case 'arrive':   return `the player arrives in ${t.key}`;
            default:         return event;
        }
    };

    // The level's actions, in the order the tables list them.
    const actionEvents = [];
    const addAction = event => { if (!actionEvents.includes(event)) actionEvents.push(event); };
    for (const building of buildings) { addAction(`enter:${building}`); addAction(`exit:${building}`); }
    for (const art of scenes.values()) {
        art.breakables.forEach(piece => addAction(`break:${piece.name}`));
        art.items.forEach(item => addAction(`take:${item.name}`));
        art.events.forEach(area => addAction(`event:${area.name}`));
        art.objects.filter(object => !object.holds.length).forEach(object => addAction(`interact:${object.name}`));
    }
    for (const group of groupNames) {
        const ways = stateNames.flatMap(name => spawnsOf(name).filter(s => s.group === group));
        if (ways.some(s => s.then !== 'flee')) addAction(`defeated:${group}`);
        if (ways.some(s => s.then === 'flee')) addAction(`fled:${group}`);
    }
    for (const { made } of combinations) if (itemNames.has(made)) addAction(`combine:${made}`);
    for (const id of itemNames) {
        if (isObject(catalog[id]) && isObject(catalog[id].use) && catalog[id].consume === true) addAction(`use:${id}`);
    }
    for (const event of named) addAction(event);

    function actionAt(f, event) {
        const t = api.trigger(event);
        const here = f.inside;
        const inScene = key => {
            if (!where.has(key)) return { value: NO, why: 'not in this level' };
            return where.get(key) === here ? { value: YES } : { value: NO, why: `it is in ${sceneName(where.get(key))}` };
        };
        const next = cloneFacts(f);
        switch (t?.kind) {
            case 'enter': {
                if (!buildings.includes(t.key)) return { value: MAYBE, effect: next };
                if (here !== null) return { value: NO, why: `the player is inside ${here}` };
                const open = openValue(f, t.key);
                if (open === NO) return { value: NO, why: 'locked' };
                next.inside = t.key;
                return { value: open, why: open < YES ? 'locked at times' : null, effect: next };
            }
            case 'exit':
                if (!buildings.includes(t.key)) return { value: MAYBE, effect: next };
                if (here !== t.key) return { value: NO, why: `the player is not inside ${t.key}` };
                next.inside = null;
                // The runtime keeps only the street's enemies: a crew still in
                // the building is dropped, though its group still counts it.
                for (const [name, g] of Object.entries(next.groups)) {
                    if (g.status === 'out' && g.scene === t.key && !g.empty) next.groups[name] = { ...g, lost: true };
                }
                return { value: YES, effect: next };
            case 'locked': {
                if (here !== null) return { value: NO, why: `the player is inside ${here}` };
                const open = buildings.includes(t.key) ? openValue(f, t.key) : YES;
                return open === YES ? { value: NO, why: 'it is open' } : { value: not(open), effect: next };
            }
            case 'break': {
                const at = inScene(event);
                if (at.value === NO) return at;
                if (f.broken.includes(t.key)) return { value: NO, why: 'already broken' };
                next.broken.push(t.key);
                return { value: YES, effect: next };
            }
            case 'take': {
                const at = inScene(event);
                if (at.value === NO) return at;
                if (f.taken.includes(t.key)) return { value: NO, why: 'already taken' };
                next.taken.push(t.key);
                next.has[t.key] = YES;
                return { value: YES, effect: next };
            }
            case 'event': {
                const at = inScene(event);
                if (at.value === NO) return at;
                if (f.fired.includes(t.key)) return { value: NO, why: 'already crossed (reported once per run)' };
                next.fired.push(t.key);
                return { value: YES, effect: next };
            }
            case 'interact': {
                const at = inScene(event);
                return at.value === NO ? at : { value: YES, effect: next };
            }
            case 'defeated':
            case 'fled': {
                const g = f.groups[t.key];
                if (!g || g.status === 'none') return { value: NO, why: `${t.key} have not come` };
                if (g.status === 'down') return { value: NO, why: `${t.key} are already beaten` };
                if (g.status === 'fled') return { value: NO, why: `${t.key} already ran off` };
                if ((t.kind === 'fled') !== g.flee) return { value: NO, why: g.flee ? `${t.key} run off` : `${t.key} fight` };
                if (g.lost) return { value: NO, why: lostWhy(t.key, g) };
                if (g.scene !== here) return { value: NO, why: `${t.key} are in ${sceneName(g.scene)}` };
                next.groups[t.key] = { ...g, status: t.kind === 'fled' ? 'fled' : 'down' };
                return { value: YES, effect: next };
            }
            case 'spawn': {
                const g = f.groups[t.key];
                return g && g.status === 'out' ? { value: MAYBE, effect: next } : { value: NO, why: `${t.key} have not come` };
            }
            case 'talk': {
                const g = f.groups[t.key];
                if (g) return g.status === 'out' && !g.lost && g.scene === here ? { value: YES, effect: next } : { value: NO, why: `${t.key} are not here` };
                return { value: MAYBE, effect: next };
            }
            case 'use':
            case 'drop': {
                const carried = f.has[t.key];
                if (carried === NO || carried === undefined) return { value: NO, why: 'not carried' };
                const consume = t.kind === 'drop' || (isObject(catalog[t.key]) && catalog[t.key].consume === true);
                if (consume) next.has[t.key] = NO;
                if (t.kind === 'drop') next.taken = next.taken.filter(item => item !== t.key);
                return { value: carried, effect: next };
            }
            case 'combine': {
                const ways = [];
                for (const [a, def] of Object.entries(catalog)) {
                    for (const [b, made] of Object.entries(isObject(def?.combine) ? def.combine : {})) if (made === t.key) ways.push([a, b]);
                }
                const way = ways.find(([a, b]) => f.has[a] && f.has[b]);
                if (!way) return { value: NO, why: 'its parts are not carried' };
                next.has[way[0]] = NO;
                next.has[way[1]] = NO;
                next.has[t.key] = YES;
                return { value: and(f.has[way[0]], f.has[way[1]]), effect: next };
            }
            case 'arrive':
                return t.key === f.s && isObject(states[f.s]?.player) && states[f.s].player.spawn !== undefined
                    ? { value: YES, effect: next } : { value: NO, why: 'the player does not come on in this state' };
            case 'unlock':
                return buildings.includes(t.key) ? { value: openValue(f, t.key) > NO ? MAYBE : NO, why: 'locked', effect: next } : { value: MAYBE, effect: next };
            case 'lock':
                return buildings.includes(t.key) ? { value: openValue(f, t.key) < YES ? MAYBE : NO, why: 'it stays open', effect: next } : { value: MAYBE, effect: next };
            case 'look':
            case 'animate':
            default:
                return { value: MAYBE, effect: next };
        }
    }

    // ── Exploring ─────────────────────────────────────────────────────────────
    const nodes = new Map();      // key -> { facts, stable, edges: [] }
    const queue = [];
    let partial = false;
    const nodeFor = facts => {
        const key = factsKey(normalizeFacts(facts));
        if (!nodes.has(key)) {
            if (nodes.size >= MAX_NODES) {
                partial = true;
                return null;
            }
            const node = { key, facts: normalizeFacts(facts), restarted: !!facts.restarted, stable: MAYBE, edges: [], actions: new Map() };
            nodes.set(key, node);
            queue.push(node);
        }
        return nodes.get(key);
    };

    if (!states[start]) {
        return { ok: false, problem: `the start state "${start}" is not in "states"`, states: [], gaps: [], notes: [] };
    }
    nodeFor(startFacts());

    while (queue.length) {
        const node = queue.shift();
        const f = node.facts;
        const name = f.s;
        // Steps on a condition fire on their own, the first that holds.
        let stays = YES;
        for (const { step, index } of stepsOf(name)) {
            if (!isConditionStep(step) || !states[step.to]) continue;
            const matches = step.on === undefined ? YES : triggerValue(f, step.on);
            const value = and(stays, matches, whenValue(f, step.when));
            if (value === NO) continue;
            const to = nodeFor(enterState(f, step.to, 0));
            if (to) node.edges.push({ kind: 'condition', event: step.on ?? null, step: index, to: to.key, toState: step.to });
            if (value === YES) {
                stays = NO;
                break;
            }
            stays = MAYBE;
        }
        node.stable = stays;
        if (stays === NO) continue;

        for (const event of actionEvents) {
            const act = actionAt(f, event);
            const record = { value: act.value, why: act.why || null, outcomes: [] };
            node.actions.set(event, record);
            if (act.value === NO || !act.effect) continue;
            const after = settle(act.effect);
            let left = YES;
            for (const { step, index } of stepsOf(name)) {
                if (step.on !== event || !states[step.to]) continue;
                const value = and(left, whenValue(after, step.when));
                if (value === NO) continue;
                const to = nodeFor(enterState(after, step.to, 0));
                if (to) {
                    node.edges.push({ kind: 'event', event, step: index, to: to.key, toState: step.to });
                    record.outcomes.push({ step: index, to: step.to });
                }
                if (value === YES) {
                    left = NO;
                    break;
                }
                left = MAYBE;
            }
            if (left > NO) {
                const to = nodeFor(after);
                if (to && to.key !== node.key) node.edges.push({ kind: 'nothing', event, step: null, to: to.key, toState: name });
                record.outcomes.push({ step: null, to: null });
            }
        }
    }

    // ── Reading the result ────────────────────────────────────────────────────
    const byState = new Map(stateNames.map(name => [name, []]));
    for (const node of nodes.values()) if (byState.has(node.facts.s)) byState.get(node.facts.s).push(node);
    // Where each state is entered from. A "reset": "level" state is passed
    // straight through to the start state, so it is entered by the edges
    // that lead to it rather than by nodes of its own.
    const enteredFrom = new Map(stateNames.map(name => [name, new Set()]));
    enteredFrom.get(start)?.add('the start');
    for (const node of nodes.values()) {
        for (const edge of node.edges) {
            if (edge.toState === node.facts.s) continue;
            enteredFrom.get(edge.toState)?.add(node.facts.s);
            if (states[edge.toState]?.reset === resetAll) enteredFrom.get(start)?.add(`${edge.toState} (starting over)`);
        }
    }

    const meant = {
        pair: (state, action) => onPurpose.pairs.find(p => p.state === state && p.action === action)
                              || onPurpose.actions.find(a => a.action === action) || null,
        state: state => onPurpose.states.find(s => s.state === state) || null,
    };
    const gaps = [];
    const notes = [];
    const gap = (kind, entry, said) => (said ? notes : gaps).push({ kind, ...entry, onPurpose: said ? said.said : null });

    const whenText = when => (isObject(when)
        ? Object.entries(when).map(([name, value]) => (value === true ? name : `not ${name}`)).join(' and ') : '');
    const stepText = (name, index) => {
        const step = states[name].next[index];
        return `to ${step.to}${step.when !== undefined ? ` when ${whenText(step.when)}` : ''}`;
    };

    const tables = [];
    for (const name of stateNames) {
        const list = byState.get(name);
        const stable = list.filter(node => node.stable > NO);
        const firedSteps = new Set(list.flatMap(node => node.edges.filter(e => e.step !== null).map(e => e.step)));
        const steps = stepsOf(name);
        const restarts = states[name]?.reset === resetAll;
        const entered = list.length > 0 || enteredFrom.get(name).size > 0;
        const table = {
            state: name, entered, passesThrough: entered && (restarts || !stable.length),
            from: [...enteredFrom.get(name)], ends: !steps.length && states[name]?.reset === undefined,
            restarts, actions: [], cannot: [],
        };
        tables.push(table);
        if (!entered) {
            gap(3, { state: name, text: `${name} is never entered: no step that can fire leads to it` }, meant.state(name));
            continue;
        }
        // A start-over state has nothing of its own to list; a state with no
        // nodes past this point only happens when the search was cut short.
        if (restarts || !list.length) continue;

        for (const event of actionEvents) {
            const records = stable.map(node => node.actions.get(event)).filter(Boolean);
            const possible = records.filter(r => r.value > NO);
            const hasSteps = steps.some(({ step }) => step.on === event);
            const reasons = [...new Set(records.filter(r => r.value === NO && r.why).map(r => r.why))];
            if (!possible.length) {
                if (records.length || hasSteps) table.cannot.push({ event, label: labelOf(event), why: reasons[0] || 'never possible here' });
                continue;
            }
            const outcomes = [];
            for (const r of possible) {
                for (const o of r.outcomes) {
                    if (!outcomes.some(x => x.step === o.step)) outcomes.push(o);
                }
            }
            outcomes.sort((a, b) => (a.step ?? 1e9) - (b.step ?? 1e9));
            const never = steps.filter(({ step, index }) => step.on === event && !firedSteps.has(index)).map(({ index }) => index);
            table.actions.push({
                event, label: labelOf(event),
                does: outcomes.map(o => (o.step === null ? 'nothing' : stepText(name, o.step))),
                nothing: outcomes.some(o => o.step === null),
                // Locked for part of the state: worth saying; "not inside" is not.
                lockedAtTimes: records.some(r => r.why === 'locked' || r.why === 'locked at times'),
                never: never.map(index => stepText(name, index)),
            });
        }

        // Each building's door, from the street, as the state has it: to read
        // against the brief's "Places".
        const outside = stable.filter(node => node.facts.inside === null);
        table.doors = buildings.map(building => {
            const values = outside.map(node => openValue(node.facts, building));
            const open = values.length && values.every(v => v === YES) ? 'open'
                       : values.every(v => v === NO) ? 'locked' : 'open at times';
            return { building, open };
        });

        // 2: no way on: steps, none of which can ever fire. A step back into
        // the same state counts, since it starts the state's spawns again.
        if (steps.length && !firedSteps.size && states[name]?.reset === undefined) {
            gap(2, { state: name, text: `${name} has steps, but none of them can fire, so the level stays here` }, meant.state(name));
        }
        // 4: never fires.
        for (const { step, index } of steps) {
            if (firedSteps.has(index) || !states[step.to]) continue;
            const t = api.trigger(step.on);
            let why;
            if (step.on === undefined || isConditionStep(step)) {
                why = `its condition never holds here (${step.on ? step.on : ''}${step.on && step.when ? ', ' : ''}${step.when ? `when ${whenText(step.when)}` : ''})`;
            } else {
                const records = stable.map(node => node.actions.get(step.on)).filter(Boolean);
                const possible = records.some(r => r.value > NO);
                const reasons = [...new Set(records.filter(r => r.value === NO && r.why).map(r => r.why))];
                why = !possible ? `${step.on} cannot happen here${reasons.length ? ` (${reasons.join('; ')})` : ''}`
                    : `when ${whenText(step.when)} never holds as ${step.on} happens`;
            }
            const said = meant.pair(name, t?.text || '') || meant.state(step.to);
            gap(4, { state: name, step: index, to: step.to, text: `${name}: the step ${stepText(name, index)} never fires: ${why}` }, said);
        }
    }

    // 1: did something, does nothing now.
    const playerKinds = [...vocab.triggers.map, ...vocab.triggers.player].filter(kind => !['animate', 'unlock', 'lock'].includes(kind));
    const seen = new Set();
    for (const node of nodes.values()) {
        for (const edge of node.edges) {
            if (edge.kind !== 'event' || edge.toState === node.facts.s) continue;
            const kind = api.trigger(edge.event)?.kind;
            if (!playerKinds.includes(kind)) continue;
            const target = tables.find(t => t.state === edge.toState);
            if (!target || target.restarts || nodes.get(edge.to)?.restarted) continue;
            const row = target.actions.find(a => a.event === edge.event);
            if (!row || !row.nothing) continue;
            const key = `${edge.toState}|${edge.event}`;
            if (seen.has(key)) continue;
            seen.add(key);
            gap(1, {
                state: edge.toState, event: edge.event, from: node.facts.s,
                text: `${edge.toState}: ${labelOf(edge.event)} (${edge.event}) does nothing, but in ${node.facts.s} it led here`,
            }, meant.pair(edge.toState, edge.event));
        }
    }

    // 2, case by case: a state that can get stuck. Some ways into it leave
    // none of its steps able to fire again, though other ways move on. A node
    // is fine if a step fires from it, it moves on at once, or something the
    // player can still do leads to such a node.
    const fine = new Set();
    for (const node of nodes.values()) {
        if (node.stable === NO || node.restarted || node.edges.some(edge => edge.step !== null)) fine.add(node.key);
    }
    for (let changed = true; changed;) {
        changed = false;
        for (const node of nodes.values()) {
            if (fine.has(node.key) || !node.edges.some(edge => fine.has(edge.to))) continue;
            fine.add(node.key);
            changed = true;
        }
    }
    const describe = f => [
        ...Object.entries(f.groups).filter(([, g]) => g.lost)
            .map(([group, g]) => `after walking out of ${sceneName(g.scene)} while ${group} were in there (gone, but still counted)`),
        f.inside ? `with the player in ${f.inside}` : null,
        ...f.taken.map(item => `${item} taken`),
        ...f.broken.map(piece => `${piece} broken`),
    ].filter(Boolean).join(', ') || 'in some cases';
    for (const table of tables) {
        const steps = stepsOf(table.state);
        if (!table.entered || table.restarts || !steps.length || gaps.concat(notes).some(g => g.kind === 2 && g.state === table.state)) continue;
        const stuck = byState.get(table.state).filter(node => node.stable > NO && !fine.has(node.key));
        if (!stuck.length) continue;
        gap(2, {
            state: table.state,
            text: `${table.state} can get stuck: ${describe(stuck[0].facts)}, none of its steps can fire any more`,
        }, meant.state(table.state));
    }

    // 5: a locked door that opens before the state that has its step. Only
    // doors that start locked: an open one is no news.
    const lockedDoors = buildings.filter(building => isObject(design?.restricted?.[building])
        || street.enterables.some(entry => entry.name === building && entry.restricted));
    for (const table of tables) {
        if (!table.entered) continue;
        for (const building of lockedDoors) {
            const doorEvents = [`enter:${building}`, `exit:${building}`];
            const hasStep = state => stepsOf(state).some(({ step }) => doorEvents.includes(step.on));
            if (hasStep(table.state)) continue;
            const opens = byState.get(table.state).some(node => node.stable > NO && node.facts.inside === null && openValue(node.facts, building) > NO);
            if (!opens) continue;
            const later = [...new Set(byState.get(table.state).flatMap(node => node.edges
                .filter(edge => edge.toState !== table.state && !doorEvents.includes(edge.event) && hasStep(edge.toState))
                .map(edge => `${edge.toState} (on ${edge.event || 'a condition'})`)))];
            if (later.length) {
                const said = meant.pair(table.state, `exit:${building}`) || meant.pair(table.state, `enter:${building}`);
                notes.push({
                    kind: 5, state: table.state, building, onPurpose: said ? said.said : null,
                    text: `${table.state}: ${building} can be open here, but only ${later.join(', ')} has a step for going through it`,
                });
            }
        }
        if (table.ends) notes.push({ kind: 'end', state: table.state, onPurpose: null, text: `${table.state} ends the level (it has no "next")` });
    }

    gaps.sort((a, b) => a.kind - b.kind);
    return { ok: true, partial, nodes: nodes.size, start, states: tables, gaps, notes, onPurpose: onPurpose.lines };
}

// ── Printing ──────────────────────────────────────────────────────────────────
function matrixMarkdown(matrix) {
    const lines = [];
    if (!matrix.ok) return `The action matrix could not be built: ${matrix.problem}\n`;
    const cell = text => String(text).replace(/\|/g, '\\|');
    for (const table of matrix.states) {
        lines.push(`### ${table.state}`, '');
        if (!table.entered) {
            lines.push('Never entered.', '');
            continue;
        }
        const from = table.from.filter(Boolean);
        lines.push(`Entered from ${from.join(', ') || 'nowhere'}.${table.restarts ? ' Starts the level over.' : ''}`
                 + `${table.passesThrough ? ' Moves on at once.' : ''}${table.ends ? ' Ends the level.' : ''}`, '');
        if (table.actions.length) {
            lines.push('| Action | Does |', '| --- | --- |');
            for (const row of table.actions) {
                const does = row.does.join('; otherwise ')
                    + (row.never.length ? `; never: ${row.never.join(', ')}` : '')
                    + (row.lockedAtTimes ? ' (locked at times)' : '');
                lines.push(`| ${cell(row.label)} (\`${row.event}\`) | ${cell(does)} |`);
            }
            lines.push('');
        }
        if (table.cannot.length) {
            lines.push(`Cannot here: ${table.cannot.map(c => `${c.label} (${c.why})`).join(', ')}.`, '');
        }
        if (table.doors && table.doors.length) {
            lines.push(`Doors: ${table.doors.map(d => `${d.building} ${d.open}`).join('; ')}.`, '');
        }
    }
    const list = (title, entries) => {
        if (!entries.length) return;
        lines.push(`### ${title}`, '');
        for (const entry of entries) lines.push(`- ${entry.text}${entry.onPurpose ? `. Brief: ${entry.onPurpose}` : ''}`);
        lines.push('');
    };
    list('Gaps', matrix.gaps);
    list('Meant (the brief\'s "Nothing on purpose")', matrix.notes.filter(n => n.onPurpose));
    list('Notes', matrix.notes.filter(n => !n.onPurpose));
    if (matrix.partial) lines.push(`Stopped after ${matrix.nodes} combinations of state and facts; the tables above are partial.`, '');
    lines.push('Worked out from the files: timing (bodies, fades, "after", "every") is checked in SANDBOX TEST.');
    return lines.join('\n') + '\n';
}

module.exports = { buildMatrix, readOnPurpose, matrixMarkdown, compareRange };

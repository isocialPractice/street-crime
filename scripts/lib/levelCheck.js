// scripts/lib/levelCheck.js - one level design checked the way SANDBOX TEST
// checks it, in node: the work behind scripts/checkLevelDesign.js, which is
// the command, and scripts/checkLevelDesignVocab.js, which checks the
// level-design skill's examples with it.

'use strict';

const fs   = require('fs');
const path = require('path');
const { createGameContext } = require('./gameContext');
const { buildMatrix, readOnPurpose } = require('./levelMatrix');

const ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_FILE = 'config/debug/sandbox.json';

// What the check does inside the game's context: SANDBOX TEST's start, in
// its order (js/ui/sandbox.js startSandbox and _sandboxStartDesign), with
// plain values out.
const CHECK_IN_CONTEXT = String.raw`
function __levelCheck(opts) {
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    const out = { itemWarnings: [], designWarnings: [], migrated: false, prepared: null };

    // The item catalog first: the design's checks read item names from it.
    if (opts.items) {
        const catalog = useItemCatalog(loadItemCatalog(opts.items));
        out.itemWarnings = [...catalog.warnings];
    } else {
        useItemCatalog(null);
    }

    // The design read once before the scene, for the layers it moves, which
    // the scene has to be built with, and the enemy variants it draws.
    const early = opts.design ? loadLevelDesign(opts.design) : null;
    const before = early && early.design ? prepareLevelDesign(early.design).design : null;
    const scene = createSvgScene({
        path: opts.level + opts.scene, worldWidth: 800, worldHeight: 600,
        levelMap: true, levelDir: opts.level, layers: before ? levelDesignLayerMoves(before) : [],
    });
    if (before) {
        for (const { enemy, render } of levelDesignEnemyVariants(before)) enemyVariant(enemy, render);
    }
    const map = scene.map;
    out.regions = map.regions.length;
    out.mapWarnings = [...map.warnings];

    // Then checked against the map, as the design starts.
    if (opts.design) {
        const loaded = loadLevelDesign(opts.design);
        const prepared = loaded.design ? prepareLevelDesign(loaded.design, map) : null;
        out.designWarnings = [...loaded.warnings, ...(prepared ? prepared.warnings : [])];
        out.migrated = !!(prepared && prepared.migrated);
        out.prepared = prepared ? prepared.design : null;
    }

    const parts = [opts.label + ': ready', plural(out.regions, 'region') + ', ' + plural(out.mapWarnings.length, 'warning')];
    if (opts.items) parts.push('items: ' + plural(out.itemWarnings.length, 'warning'));
    if (opts.design) {
        parts.push(!out.prepared ? 'no design: ' + out.designWarnings[0]
            : 'design' + (out.migrated ? ' (draft, converted)' : '') + ': ' + plural(out.designWarnings.length, 'warning'));
    }
    out.status = parts.join(', ');

    if (opts.layers || opts.names) {
        out.art = __levelLayers(map, opts.names);
        out.interiors = [];
        if (opts.layers) {
            const finder = { stage: { scene }, options: { enterables: opts.enterables || {} }, notify() {} };
            for (const entry of map.enterables) {
                const door = map.hotspots.find(spot => spot.enterable === entry.name && spot.type === 'building');
                if (!door) continue;
                const interior = LevelMapRuntime.prototype._interiorPath.call(finder,
                    { id: door.id, key: entry.name, enterable: entry.name });
                if (!interior) {
                    out.interiors.push({ name: entry.name, path: null });
                    continue;
                }
                const inside = LevelMapRuntime.prototype._interiorScene.call(null, interior, scene);
                out.interiors.push({
                    name: entry.name, path: interior,
                    regions: inside.map ? inside.map.regions.length : 0,
                    warnings: inside.map ? [...inside.map.warnings] : [],
                    art: inside.map ? __levelLayers(inside.map, false) : null,
                });
            }
        }
    }
    out.prepared = out.prepared ? JSON.parse(JSON.stringify(out.prepared)) : null;
    return JSON.parse(JSON.stringify(out));
}

// __levelLayers - a map's layers by kind, each with the shortest path that
// names it alone (levelMapFindAll finds just it), the way a design writes it.
// Illustrator's "-<n>" copy numbers are left off where the path still names
// the one layer, since a path is matched with or without them and the number
// changes whenever the art is redrawn: "ENTERABLE-bad-bar/ENTER-building",
// not "ENTER-building-2".
function __levelLayers(map, withNames) {
    const byId = new Map(map.regions.map(region => [region.id, region]));
    const plain = part => part.replace(/-\d+$/, '');
    const pathOf = id => {
        const chain = [];
        for (let node = byId.get(id); node; node = node.parent ? byId.get(node.parent) : null) chain.unshift(node.id);
        for (const form of [plain, part => part]) {
            for (let n = 1; n <= chain.length; n++) {
                const candidate = chain.slice(chain.length - n).map(form).join('/');
                const found = levelMapFindAll(map, candidate);
                if (found.length === 1 && found[0].id === id) return candidate;
            }
        }
        return chain.join('/');
    };
    return {
        doors: map.hotspots.map(spot => ({
            id: spot.id, path: pathOf(spot.id), type: spot.type, into: spot.enterable, restricted: spot.restricted,
        })),
        enterables: map.enterables.map(entry => ({
            id: entry.id, name: entry.name, restricted: entry.restricted,
            requires: entry.requires.map(req => req.type + ':' + req.name),
        })),
        objects: map.objects.map(object => ({ id: object.id, name: object.name, holds: object.children })),
        breakables: map.breakables.map(piece => ({ id: piece.id, name: piece.name, path: pathOf(piece.id), object: piece.object })),
        items: map.items.map(item => ({ id: item.id, name: item.name, path: pathOf(item.id), object: item.object })),
        events: map.events.map(area => ({ id: area.id, name: area.name, path: pathOf(area.id) })),
        animations: map.animations.map(anim => ({ id: anim.id, asset: anim.assetName, object: anim.object, frames: anim.frames.length })),
        holes: map.holes.map(hole => hole.id),
        reserved: map.reserved.map(entry => ({ id: entry.id, label: entry.label })),
        moved: map.layers.map(layer => ({ id: layer.id, name: layer.name, paths: layer.paths })),
        names: withNames ? [...map.ids] : undefined,
        nameCount: map.ids.length,
    };
}
`;


// Repository paths with forward slashes, as the game and sandbox.json write them.
function repoPath(file) {
    return path.relative(ROOT, path.resolve(ROOT, file)).split(path.sep).join('/');
}

function exists(file) {
    return fs.existsSync(path.join(ROOT, file));
}

function sandboxTests() {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, SANDBOX_FILE), 'utf8'));
    return raw && typeof raw.tests === 'object' ? raw.tests : {};
}

// resolve - what to check, as { label, test, design, level, scene, items,
// enterables }, from a target and the options. Throws with the reason when
// it cannot be worked out.
function resolve(target, opts) {
    const tests = sandboxTests();
    const fromTest = (key, test) => ({
        label: typeof test.label === 'string' && test.label.trim() ? test.label.trim() : key,
        test: key,
        design: test.design || null,
        level: test.level,
        scene: test.scene,
        items: opts.items || test.items || null,
        enterables: test.enterables || {},
        inventory: Array.isArray(test.inventory) ? test.inventory : [],
    });

    if (tests[target]) return fromTest(target, tests[target]);

    let design = null;
    let outside = null;   // a design file outside the repository, served in its place
    const levelFile = `config/levels/${target}/level-design.json`;
    if (exists(levelFile)) design = levelFile;
    else if (/\.json$/i.test(target)) {
        const file = path.resolve(ROOT, target);
        if (!fs.existsSync(file)) throw new Error(`there is no file ${target}`);
        if (file.startsWith(ROOT + path.sep)) {
            design = repoPath(file);
        } else {
            outside = file;
            design = `.outside/${path.basename(file)}`;
        }
    } else {
        const keys = Object.keys(tests);
        throw new Error(`"${target}" is not a sandbox test (${keys.join(', ')}), a level under config/levels/, or a .json file`);
    }

    // A sandbox test that runs this design brings its art, items and interiors.
    if (!opts.svg && !outside) {
        const match = Object.entries(tests).find(([, test]) => test.design && repoPath(test.design) === design);
        if (match) return fromTest(match[0], match[1]);
    }
    let svg = opts.svg ? repoPath(opts.svg) : null;
    if (!svg) {
        const level = /^config\/levels\/([^/]+)\/level-design\.json$/.exec(design)?.[1];
        const guess = level && `assets/levels/${level}/level-${level}.svg`;
        if (guess && exists(guess)) svg = guess;
        else throw new Error(`no sandbox test runs ${design}; name its art with --svg assets/levels/<level>/level-<level>.svg`);
    }
    if (!exists(svg)) throw new Error(`there is no art at ${svg}`);
    return {
        label: outside ? target : design, test: null, design, outside,
        level: svg.slice(0, svg.lastIndexOf('/') + 1), scene: svg.slice(svg.lastIndexOf('/') + 1),
        items: opts.items ? repoPath(opts.items) : null, enterables: {}, inventory: [],
    };
}

// briefFor - where a design's brief is: beside a level's level-design.json as
// level-brief.md, else as <design>.brief.md.
function briefFor(design, given) {
    if (given) return repoPath(given);
    if (!design) return null;
    return /(^|[\\/])level-design\.json$/.test(design) ? design.replace(/level-design\.json$/, 'level-brief.md')
                                                        : design.replace(/\.json$/i, '.brief.md');
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    } catch (e) {
        return null;
    }
}

// check - a resolved target (resolve) checked: the sandbox's status, and with
// opts.layers, opts.names or opts.matrix the art's layers and the action
// matrix. extra.files are served in place of files on disk (a level made up
// for a check); extra.briefText stands in for the brief beside the design.
function check(spec, opts, extra = {}) {
    const files = { ...(extra.files || {}) };
    if (spec.outside) files[spec.design] = fs.readFileSync(spec.outside, 'utf8');
    const game = createGameContext({ root: ROOT, files });
    game.run(CHECK_IN_CONTEXT);
    const result = game.call('__levelCheck', {
        label: spec.label, design: spec.design, level: spec.level, scene: spec.scene,
        items: spec.items, enterables: spec.enterables,
        layers: opts.layers || opts.matrix, names: opts.names,
    });
    const out = { ...spec, ...result, showLayers: opts.layers || opts.names, notes: [...game.notes] };
    if (opts.matrix && result.prepared && result.art) {
        // The brief: given, or beside the design (outside the repository too).
        const brief = extra.briefText !== undefined ? '(given)'
                    : spec.outside && !opts.brief ? briefFor(spec.outside) : briefFor(spec.design, opts.brief);
        const briefFile = brief && brief !== '(given)' ? path.resolve(ROOT, brief) : null;
        const briefText = extra.briefText !== undefined ? extra.briefText
                        : briefFile && fs.existsSync(briefFile) ? fs.readFileSync(briefFile, 'utf8') : null;
        out.briefLookedFor = brief;
        const catalogFile = spec.items ? readJson(spec.items) : null;
        const catalog = catalogFile && typeof catalogFile.items === 'object' ? catalogFile.items : {};
        const ctx = game.ctx;
        out.brief = briefText !== null ? brief : null;
        out.matrix = buildMatrix({
            design: result.prepared,
            street: result.art,
            interiors: result.interiors || [],
            catalog,
            startInventory: spec.inventory.map(entry => (typeof entry === 'string' ? entry : entry?.item)).filter(Boolean),
            onPurpose: readOnPurpose(briefText, Object.keys(result.prepared.states || {})),
            api: {
                trigger: ctx.levelDesignTrigger,
                condition: ctx.levelDesignCondition,
                spawn: ctx.levelDesignSpawn,
                caseEntries: ctx.levelDesignCaseEntries,
                poolSlots: ctx.levelDesignPoolSlots,
                vocab: game.run('LEVEL_DESIGN_VOCAB'),
            },
        });
    }
    return out;
}

// A result's gaps that the brief does not mean.
const openGaps = result => (result.matrix ? result.matrix.gaps.length : 0);

module.exports = { ROOT, SANDBOX_FILE, resolve, check, briefFor, sandboxTests, openGaps, repoPath, exists, readJson };

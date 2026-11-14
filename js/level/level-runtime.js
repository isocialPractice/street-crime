// js/level/level-runtime.js - what a level map does while its level is played
//
// The level map (js/level/level-map.js) is read once per scene and never
// changes; a cached scene is shared by every run of it. What happens during
// play lives here instead, one runtime per run, so restarting a level is
// simply a new runtime: nothing reported, nothing broken, back outside.
// game.js calls update() once a frame while the game is playing.
//
// Doors
// -----
// Every ENTER- element is a hotspot, and so is an OBJECT- area with nothing
// animated or breakable in it. Standing at one with nothing in hand shows a
// prompt over the player. E uses it at once; pushing into it (Up at a door,
// Left at an interior's left edge) for CFG.enterHoldTime does too.
//
// Going through a building's door fades out, swaps the scene for the
// interior, and fades back in, with the player's controls held throughout.
// The scene left behind is kept, with its enemies, breakables and pickups, on
// a stack, and leaving the interior puts all of it back, the player just below
// the door they went in by.
//
// Locks
// -----
// A door inside a RESTRICTED- layer is locked until unlock(name) is called
// with the RESTRICTED's name; the level design does that when the condition
// it names comes true. Using a locked door reports "locked:<name>" and shows
// E: LOCKED instead of going through. Unlocking reports "unlock:<name>" and
// lasts for the run, in every scene, unless the design locks it again
// (lock(), reporting "lock:<name>"), as a lock that follows a condition does.
//
// Items
// -----
// An INVENTORY-<item> layer is an item lying there (js/entities/items.js),
// kept per scene for the run: one taken stays taken, in the street and in
// every building. Standing at it shows E: CHECK, and E says what it is and
// asks whether to take it. Taking reports "take:<item>".
//
// Trigger areas
// -------------
// An EVENT-<name> area reports "event:<name>" the first time the player's
// feet are in it, once per run.
//
// Moving layers
// -------------
// A layer the level design moves ("animate-layers") slides when moveLayer is
// called, and reports "animate:<layer>" the first time it gets where it was
// sent. Where each one is lives here, per scene, so RESTART puts every door
// back the way the art draws it.

// Interiors are built the first time a door leads to one and kept for the
// page, like the sandbox's own scenes. A run's state inside them is not.
const _levelInteriorScenes = new Map();

// The way out of an interior that has no ENTER-exit of its own: its leftmost
// strip, walked into with Left held (or E).
const LEVEL_IMPLICIT_EXIT_W = 96;

// What each ENTER type does, by the method that does it.
const LEVEL_ENTER_HANDLERS = {
    building: '_enterBuilding',
    exit:     '_exitScene',
    vehicle:  '_enterVehicle',
};

// How far below a hotspot to look for ground to stand on, and how deep that
// ground must be to count. See levelFieldGapBelow.
const LEVEL_FIELD_GAP_MAX     = 200;
const LEVEL_FIELD_STAND_DEPTH = 12;

// _levelStandable - whether feet can stand at (x, y): inside #field and
// outside every negative-space hole.
function _levelStandable(x, y, polygon, holes) {
    return _pointInPolygon(x, y, polygon) && !_pointInStageHole(x, y, holes);
}

// levelFieldGapBelow - how far below a rect's bottom edge there is ground to
// stand on, at the rect's centre, in world px: 0 when it already is. A door is
// drawn on a building's face and often stops at the sidewalk while #field is
// the street below it, sometimes with a parked car's hole in between; its
// reach, the player coming back out of it, and anyone spawned from it all
// bridge that gap. Ground counts once LEVEL_FIELD_STAND_DEPTH px of it run
// unbroken, so a sliver of field between the edge and a hole is passed over.
// A rect with no such ground within LEVEL_FIELD_GAP_MAX counts as 0, and stays
// out of reach: that is a level whose field was not drawn to it.
function levelFieldGapBelow(stage, rect) {
    const polygon = typeof stageFieldPolygon === 'function' ? stageFieldPolygon(stage) : null;
    if (!polygon || !rect) return 0;
    const holes = stageFieldHoles(stage);
    const cx = rect.x + rect.w * 0.5;
    const bottom = rect.y + rect.h;
    let runStart = null;
    for (let d = 0; d <= LEVEL_FIELD_GAP_MAX + LEVEL_FIELD_STAND_DEPTH; d += 2) {
        if (!_levelStandable(cx, bottom + d, polygon, holes)) {
            runStart = null;
            continue;
        }
        if (runStart === null) runStart = d;
        if (d - runStart >= LEVEL_FIELD_STAND_DEPTH) return runStart <= LEVEL_FIELD_GAP_MAX ? runStart : 0;
    }
    return 0;
}

// "bad-bar" -> "badBar", the other name an enterable's interior may be saved
// under. Layer names are kebab-case; asset files in this repo are camelCase.
function _levelCamelName(name) {
    return name.replace(/[-_]+([a-z0-9])/gi, (_, c) => c.toUpperCase());
}

class LevelMapRuntime {
    // options.enterables  enterable name (or hotspot id) -> interior path,
    //                     relative to the level folder: the test's "enterables".
    // options.notify      where to say that something cannot be done, such as
    //                     a door with no interior. The console by default.
    constructor(stageData, options = {}) {
        this.options     = options;
        this.notify      = options.notify || (text => console.warn('[level-map] %s', text));
        this.reported    = new Set();   // "<kind>:<key>" already sent this run
        this.stack       = [];          // scenes the player went in from, innermost last
        this.sceneStates = new Map();   // scene -> { breakables, layers } for this run
        this.fade        = null;        // { phase: 'out' | 'wait' | 'in', t, swap, ready }
        this.active      = null;        // the hotspot the player can use right now
        this.unlocked    = new Set();   // RESTRICTED names opened this run
        this._enterScene(stageData);
    }

    update(dt, player) {
        this._updateAnimations();
        this._updateLayers(dt);
        for (const item of this.items) item.update(dt);
        for (const piece of this.breakables) {
            if (piece.broken) this._report('break', piece.name);
        }
        if (this.fade) {
            this._updateFade(dt, player);
        } else if (player) {
            this._updateEventAreas(player);
            this._updateHotspots(dt, player);
        }
    }

    // ── Locks ─────────────────────────────────────────────────────────────────
    isLocked(name) {
        return !this.unlocked.has(name) && this.restrictedEntries().some(entry => entry.name === name);
    }

    // unlock - open a RESTRICTED for the rest of the run, or until lock().
    // Safe to call more than once, or for a name this scene does not have (it
    // may be in another).
    unlock(name) {
        if (this.unlocked.has(name)) return;
        this.unlocked.add(name);
        this.forget(`lock:${name}`);
        this._report('unlock', name);
    }

    // lock - close a RESTRICTED that was opened: a level design lock that
    // follows a condition which stopped holding, or a "reset". Reports
    // "lock:<name>", and the next unlock reports "unlock:<name>" again. A
    // player already inside can still leave: locks are on the way in.
    lock(name) {
        if (!this.unlocked.has(name)) return;
        this.unlocked.delete(name);
        this.forget(`unlock:${name}`);
        this._report('lock', name);
    }

    // forget - let reports that were sent this run be sent again, for things
    // that can happen more than once: a gate mended and broken again, a group
    // spawned again, a case that turns false and back.
    forget(...events) {
        for (const event of events) this.reported.delete(event);
    }

    // resetBreakable - a BREAKABLE whole again, in every scene of the run that
    // has one by that name, and able to report "break:<name>" again. False
    // when none was found.
    resetBreakable(name) {
        let found = false;
        for (const { breakables } of this.sceneStates.values()) {
            for (const piece of breakables) {
                if (piece.name !== name) continue;
                piece.restore();
                found = true;
            }
        }
        this.forget(`break:${name}`);
        return found;
    }

    // resetLayer - a layer the design moves back where the art draws it, at
    // once, and able to report "animate:<layer>" again. False when no scene of
    // the run was built to move it.
    resetLayer(path) {
        let found = false;
        for (const [scene, state] of this.sceneStates) {
            const layer = levelMapFindLayer(scene?.map, path);
            if (!layer) continue;
            state.layers.delete(layer.id);
            this.forget(`animate:${layer.name}`);
            found = true;
        }
        return found;
    }

    // resetRun - the run back to how it started, for a level design's
    // "reset": "level": out to the street if the player is inside somewhere
    // (just below the door they went in by, as when walking out), every
    // breakable whole, every moved layer back, every lock closed, the street's
    // enemies, pickups and effects gone, and nothing reported yet.
    resetRun(player) {
        if (this.stack.length) {
            const frame = this.stack[0];
            this.stack.length = 0;
            currentStageData = frame.stage;
            cam.x = frame.camX;
            this._enterScene(frame.stage);
            if (player) {
                const door = frame.door;
                player.x = door.x + door.w * 0.5 - player.w * 0.5;
                player.y = door.y + door.h + frame.doorGap + CFG.enterDepthTol + 4 - player.h;
                player.clampToStageField();
            }
        }
        for (const [scene, state] of this.sceneStates) {
            state.breakables.forEach(piece => piece.restore());
            state.layers.clear();
            state.items = levelMapItems(scene);
        }
        this.unlocked.clear();
        this.reported.clear();
        enemies    = [];
        pickups    = [];
        effects    = [];
        breakables = this.breakables;
        this.items = this.sceneStates.get(this.stage.scene).items;
        this.hotspots = this._sceneHotspots(this.stage.scene);
    }

    // ── Items ─────────────────────────────────────────────────────────────────
    // worldItems - the items lying in the scene the player is in, not taken.
    worldItems() {
        return this.items.filter(item => !item.taken);
    }

    // nearby - what lies within range px of the player's feet, nearest first,
    // as [{ kind, key, rect, distance, ref, ... }]: items not taken, doors
    // (with type and enterable), OBJECT- areas, breakables (with broken), and
    // enemies standing. Distance is to each thing's box; a door's or an
    // object's reaches down to the ground below it, as its reach does, since
    // it is drawn on a wall the player cannot stand against. What the command
    // line's LOOK and TAKE read.
    nearby(player, range) {
        const cx = player.x + player.w * 0.5;
        const feet = player.y + player.h;
        const things = [];
        const add = (kind, key, rect, extra = {}) => {
            const dx = Math.max(rect.x - cx, 0, cx - (rect.x + rect.w));
            const dy = Math.max(rect.y - feet, 0, feet - (rect.y + rect.h));
            const distance = Math.hypot(dx, dy);
            if (distance <= range) things.push({ kind, key, rect, distance, ...extra });
        };
        const down = (rect, gap) => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h + (gap || 0) });
        for (const spot of this.hotspots) {
            if (spot.kind === 'item') {
                if (!spot.item.taken) add('item', spot.key, spot.rect, { ref: spot.item });
            } else if (spot.kind === 'enter') {
                add('door', spot.key, down(spot.rect, spot.gap), { ref: spot, type: spot.type, enterable: spot.enterable });
            } else {
                add('object', spot.key, down(spot.rect, spot.gap), { ref: spot });
            }
        }
        // OBJECT- areas holding something are not hotspots, but are there.
        for (const object of this.stage?.scene?.map?.objects || []) {
            if (!object.children.length) continue;
            add('object', object.name, down(object.world, levelFieldGapBelow(this.stage, object.world)), { ref: object });
        }
        for (const piece of this.breakables) {
            add('breakable', piece.name, { x: piece.x, y: piece.y - piece.h, w: piece.w, h: piece.h },
                { ref: piece, broken: piece.broken });
        }
        for (const enemy of typeof enemies !== 'undefined' ? enemies : []) {
            if (enemy.dead || enemy.fled) continue;
            add('enemy', enemy.spawnGroup || enemy.def?.variantOf || enemy.typeId,
                { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h }, { ref: enemy });
        }
        return things.sort((a, b) => a.distance - b.distance);
    }

    // dropItem - an item put down at (x, feet y) in the scene the player is
    // in: what the sandbox's DROP does. It can be taken again, once the
    // player has stepped away from it.
    dropItem(item, x, y) {
        const dropped = new WorldItem({ item, x, y, dropped: true });
        this.items.push(dropped);
        this.hotspots = this._sceneHotspots(this.stage.scene);
        return dropped;
    }

    // restrictedEntries - the level map's RESTRICTED entries in the scenes
    // this run is in (the current one and the ones it was entered from), one
    // per name, so a lock still holds after going into another building and
    // back out. The level design reads their REQUIRE- layers from here.
    restrictedEntries() {
        const byName = new Map();
        const scenes = [this.stage, ...this.stack.map(frame => frame.stage)];
        for (const stage of scenes) {
            for (const entry of stage?.scene?.map?.enterables || []) {
                if (entry.restricted && !byName.has(entry.name)) byName.set(entry.name, entry);
            }
        }
        return [...byName.values()];
    }

    // report - send a level-map event once per run, for code outside the
    // runtime (the level design) that reports through the same bus.
    report(kind, key) {
        this._report(kind, key);
    }

    // fadeThrough - fade to black and back in the scene the player is in,
    // running swap while the screen is black: a level design's "fade-out".
    // The scene is already on screen, so there is nothing to wait for once it
    // is black. During a door's fade the swap simply runs at once, since the
    // screen is already on its way to black for a reason of its own.
    fadeThrough(player, swap) {
        if (this.fade || !player) {
            swap();
            return;
        }
        this._startFade(player, this.stage.scene, swap);
        this.fade.ready = true;
    }

    _spotLocked(spot) {
        return !!spot && spot.kind === 'enter' && spot.restricted && this.isLocked(spot.key);
    }

    // ── Trigger areas ─────────────────────────────────────────────────────────
    // Feet in the area, standing or in the air: a trigger is a place on the
    // ground, and jumping across it still crosses it.
    _updateEventAreas(player) {
        const cx   = player.x + player.w * 0.5;
        const feet = player.y + player.h;
        for (const area of this.stage?.scene?.map?.events || []) {
            const r = area.world;
            if (cx >= r.x && cx <= r.x + r.w && feet >= r.y && feet <= r.y + r.h) {
                this._report('event', area.name);
            }
        }
    }

    // _report - send a level-map event once per run. A feature can keep
    // noticing the same thing every frame without the listeners hearing it
    // every frame. One-off actions (going through a door) emit directly.
    _report(kind, key) {
        const event = `${kind}:${key}`;
        if (this.reported.has(event)) return;
        this.reported.add(event);
        levelMapEmit(kind, key);
    }

    // ── Scene ─────────────────────────────────────────────────────────────────
    // _enterScene - make a stage the one being played: its breakables for this
    // run (made on the first visit, kept for later ones, so a broken thing stays
    // broken), its hotspots, and a fresh start for arming them.
    _enterScene(stage) {
        this.stage = stage;
        this.sceneStartedAt = performance.now() / 1000;
        const scene = stage?.scene;
        if (!this.sceneStates.has(scene)) {
            // layers: layer id -> { x, y, move }, offsets in world px
            // items: what lies there to take, as WorldItems; taken ones stay
            // taken for the run, so going out and back in never brings one back
            this.sceneStates.set(scene, {
                breakables: levelMapBreakables(scene), layers: new Map(),
                items: levelMapItems(scene, this.notify),
            });
        }
        this.breakables = this.sceneStates.get(scene).breakables;
        this.items      = this.sceneStates.get(scene).items;
        this.hotspots   = this._sceneHotspots(scene);
        // hotspot -> whether it can be used: false until the player has been
        // out of its reach once, so arriving in one never uses it straight away.
        this.armed      = new Map();
        this.active     = null;
        this.pushSpot   = null;
        this.pushT      = 0;
    }

    _sceneHotspots(scene) {
        const map = scene?.map;
        const spots = (map?.hotspots || []).map(h => ({
            kind: 'enter', type: h.type, id: h.id, key: h.enterable || h.id,
            enterable: h.enterable, restricted: !!h.restricted, rect: h.world, push: h.push,
            gap: levelFieldGapBelow(this.stage, h.world),
        }));
        for (const object of map?.objects || []) {
            if (object.children.length) continue;
            spots.push({ kind: 'interact', type: 'interact', id: object.id, key: object.name,
                         rect: object.world, push: null, gap: levelFieldGapBelow(this.stage, object.world) });
        }
        for (const item of this.items || []) {
            spots.push({ kind: 'item', type: 'item', id: item.id, key: item.item, item,
                         rect: item.box, push: null, gap: levelFieldGapBelow(this.stage, item.box) });
        }
        if (this.stack.length && !spots.some(spot => spot.type === 'exit')) {
            spots.push({
                kind: 'enter', type: 'exit', id: 'implicit exit', key: this.stack[this.stack.length - 1].key,
                rect: { x: 0, y: 0, w: LEVEL_IMPLICIT_EXIT_W, h: scene.worldHeight }, push: 'left', gap: 0,
            });
        }
        // Doors, then items, then plain interact areas, when the player
        // stands in more than one.
        const rank = spot => (spot.kind === 'enter' ? 0 : spot.kind === 'item' ? 1 : 2);
        return spots.sort((a, b) => rank(a) - rank(b));
    }

    // ── Hotspots ──────────────────────────────────────────────────────────────
    // In reach: the player's centre is over the hotspot, and their feet are
    // within enterDepthTol of its depth span. A door sits above the field, so
    // its reach is the strip of walkable ground at its foot; where the field
    // starts some way below the door, the reach runs down to it (spot.gap).
    _inReach(spot, player) {
        const cx   = player.x + player.w * 0.5;
        const feet = player.y + player.h;
        const tol  = CFG.enterDepthTol;
        const r    = spot.rect;
        return player.grounded && cx >= r.x && cx <= r.x + r.w
            && feet >= r.y - tol && feet <= r.y + r.h + (spot.gap || 0) + tol;
    }

    _updateHotspots(dt, player) {
        let active = null;
        for (const spot of this.hotspots) {
            if (spot.item?.taken) continue;
            if (!this._inReach(spot, player)) {
                this.armed.set(spot, true);
                continue;
            }
            if (!this.armed.has(spot)) this.armed.set(spot, false);
            if (!active && this.armed.get(spot) && !player.held) active = spot;
        }
        this.active = active;
        if (active !== this.pushSpot) {
            this.pushSpot = active;
            this.pushT = 0;
        }
        if (!active) return;

        const pushing = active.push === 'up'   ? (Keys['ArrowUp'] || Keys['KeyW'])
                      : active.push === 'left' ? (Keys['ArrowLeft'] || Keys['KeyA'])
                      : false;
        this.pushT = pushing ? this.pushT + dt : 0;
        if (JustPressed['KeyE'] || (active.push && this.pushT >= CFG.enterHoldTime)) {
            this.pushT = 0;
            this._use(active, player);
        }
    }

    // _use - do what a hotspot is for. Anything that cannot go ahead (no
    // interior, a type with no handler) disarms the hotspot until the player
    // steps away, so holding Up at it says so once rather than every frame.
    _use(spot, player) {
        if (spot.kind === 'interact') {
            levelMapEmit('interact', spot.key);
            return;
        }
        // An item: what it is, and whether to take it (js/entities/items.js).
        if (spot.kind === 'item') {
            if (!spot.item.taken) itemOffer(player, spot.item);
            this.armed.set(spot, false);
            this.active = null;
            return;
        }
        // Reported on every try, like going through a door: each one is the
        // player doing something, not the level noticing a state.
        if (this._spotLocked(spot)) {
            levelMapEmit('locked', spot.key);
            this.armed.set(spot, false);
            this.active = null;
            return;
        }
        const method = LEVEL_ENTER_HANDLERS[spot.type];
        const went = method ? this[method](spot, player) : false;
        if (!method) this.notify(`${spot.id}: ENTER type "${spot.type}" has no handler`);
        if (!went) {
            this.armed.set(spot, false);
            this.active = null;
        }
    }

    // ── ENTER handlers. Each returns whether the player is on the way through.
    _enterBuilding(spot, player) {
        const path = this._interiorPath(spot);
        if (!path) return false;
        const outer = this.stage;
        const scene = this._interiorScene(path, outer.scene);
        this._startFade(player, scene, () => {
            this.stack.push({ stage: outer, key: spot.key, door: spot.rect, doorGap: spot.gap || 0, camX: cam.x,
                              enemies, breakables, pickups });
            const stage = { name: `${outer.name} > ${spot.key}`, scene, levelMap: outer.levelMap };
            currentStageData = stage;
            enemies = [];
            effects = [];
            pickups = [];
            cam.x   = 0;
            this._enterScene(stage);
            breakables = this.breakables;
            this._placeInInterior(player);
            levelMapEmit('enter', spot.key);
        });
        return true;
    }

    _exitScene(spot, player) {
        const frame = this.stack[this.stack.length - 1];
        if (!frame) {
            this.notify(`${spot.id}: there is no scene to go back out to`);
            return false;
        }
        this._startFade(player, frame.stage.scene, () => {
            this.stack.pop();
            currentStageData = frame.stage;
            enemies    = frame.enemies;
            breakables = frame.breakables;
            pickups    = frame.pickups;
            effects    = [];
            // The camera goes back first: the player cannot stand left of it.
            cam.x = frame.camX;
            this._enterScene(frame.stage);
            // Just below the door, out of its reach, so stepping out does not
            // walk straight back in.
            const door = frame.door;
            player.x = door.x + door.w * 0.5 - player.w * 0.5;
            player.y = door.y + door.h + frame.doorGap + CFG.enterDepthTol + 4 - player.h;
            player.clampToStageField();
            levelMapEmit('exit', frame.key);
        });
        return true;
    }

    // Recognised so a level can already mark its cars, and so using one says
    // what is missing instead of silently doing nothing.
    _enterVehicle(spot) {
        this.notify(`${spot.id}: ENTER-vehicle is recognised, but its handler is not built yet`);
        return false;
    }

    // _interiorPath - the interior a building's door leads to: the test's
    // "enterables" entry, else enterables/<name>.svg in the level folder, else
    // the camelCase name. Null, after saying where it looked, when none exists.
    _interiorPath(spot) {
        const dir = this.stage.scene.levelDir || '';
        const configured = this.options.enterables?.[spot.key];
        const tried = [];
        if (typeof configured === 'string' && configured.trim()) tried.push(dir + configured.trim());
        if (spot.enterable) {
            tried.push(`${dir}enterables/${spot.enterable}.svg`);
            const camel = _levelCamelName(spot.enterable);
            if (camel !== spot.enterable) tried.push(`${dir}enterables/${camel}.svg`);
        }
        const found = tried.find(path => _levelMapReadSvg(path) !== null);
        if (found) return found;
        this.notify(tried.length
            ? `${spot.id}: no interior at ${tried.join(' or ')}`
            : `${spot.id} is not inside an ENTERABLE; name its interior under "${spot.key}" in the test's "enterables"`);
        return null;
    }

    // An interior is laid out like the level it opens from: the same section
    // width and height, and the same folder for its own animated pieces.
    _interiorScene(path, outerScene) {
        const key = [path, outerScene.sectionWorldWidth, outerScene.worldHeight].join('|');
        if (!_levelInteriorScenes.has(key)) {
            const scene = createSvgScene({
                path,
                worldWidth:  outerScene.sectionWorldWidth,
                worldHeight: outerScene.worldHeight,
                levelMap:    true,
                levelDir:    outerScene.levelDir,
            });
            (scene.map?.warnings || []).forEach(text => console.warn('[level-map] %s: %s', path, text));
            _levelInteriorScenes.set(key, scene);
        }
        return _levelInteriorScenes.get(key);
    }

    // Arrive at the interior's own way out when it has one (just clear of it,
    // as when coming out of a door), else somewhere past the implicit exit.
    _placeInInterior(player) {
        const exit = this.hotspots.find(spot => spot.type === 'exit' && spot.id !== 'implicit exit');
        if (exit) {
            const r = exit.rect;
            player.x = r.x + r.w * 0.5 - player.w * 0.5;
            player.y = r.y + r.h + (exit.gap || 0) + CFG.enterDepthTol + 4 - player.h;
        } else {
            const spawn = sampleStageEntityPosition(this.stage, player.w, player.h, {
                minX: LEVEL_IMPLICIT_EXIT_W + 24,
                maxX: LEVEL_IMPLICIT_EXIT_W + 144,
            });
            if (spawn) {
                player.x = spawn.x;
                player.y = spawn.y;
            }
        }
        player.clampToStageField();
    }

    // ── Fade ──────────────────────────────────────────────────────────────────
    // _startFade - hold the player, fade to black, run swap, fade back in. The
    // scene being faded into starts decoding now; if it is not ready by the time
    // the screen is black, it stays black until it is (for up to 3 s), so the
    // fade never opens on a blank level.
    _startFade(player, scene, swap) {
        const images = scene ? [
            scene.img,
            ...levelSceneAnimations(scene).flatMap(anim => anim.frames),
            ...Object.values(levelSceneBreakableSprites(scene)).flatMap(Object.values),
            ...levelSceneLayerImages(scene),
            ...Object.values(levelSceneItemSprites(scene)),
        ].filter(Boolean) : [];
        const fade = { phase: 'out', t: 0, swap, ready: false };
        Promise.all(images.map(img => (img.decode ? img.decode().catch(() => {}) : null)))
            .then(() => { fade.ready = true; });
        this.fade = fade;
        this.active = null;

        player.vx = player.vy = 0;
        player.isRun = false;
        if (player.grounded && !player.busy) player.setState('idle');
        player.holdT = CFG.enterFadeTime * 2 + 0.1;
    }

    _updateFade(dt, player) {
        const fade = this.fade;
        const time = Math.max(0.01, CFG.enterFadeTime);
        fade.t += dt;
        // However long the swap waits on decoding, the controls stay held.
        if (player) player.holdT = Math.max(player.holdT, 0.05);

        if (fade.phase === 'out' && fade.t >= time) fade.phase = 'wait';
        if (fade.phase === 'wait' && (fade.ready || fade.t >= time + 3)) {
            fade.swap();
            fade.phase = 'in';
            fade.t = 0;
        } else if (fade.phase === 'in' && fade.t >= time) {
            this.fade = null;
            if (player) player.holdT = 0;
        }
    }

    // ── Drawing (called from draw()) ──────────────────────────────────────────
    drawPrompt(player) {
        if (this.fade || !this.active || !player) return;
        const label = this.active.kind === 'interact'  ? 'E: INTERACT'
                    : this.active.kind === 'item'      ? 'E: CHECK'
                    : this._spotLocked(this.active)    ? 'E: LOCKED'
                    : this.active.type === 'exit'      ? 'E: EXIT'
                    : 'E: ENTER';
        // Over the head as drawn: the sprite stands on the feet and is taller
        // than the hit box, so the box's top would put the prompt on the chest.
        const img = player.getImg();
        const spriteH = (img && img.naturalWidth && _playerDrawSize(img).h) || player.h;
        const x = player.screenX + player.w * 0.5;
        const y = player.drawY + player.h - spriteH - 8;
        ctx.save();
        ctx.font = 'bold 13px "Courier New"';
        ctx.textAlign = 'center';
        const w = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - w / 2, y - 13, w, 18);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(label, x, y);
        ctx.restore();
    }

    drawFade() {
        if (!this.fade) return;
        const time = Math.max(0.01, CFG.enterFadeTime);
        const { phase, t } = this.fade;
        const a = phase === 'out' ? t / time : phase === 'in' ? 1 - t / time : 1;
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
        ctx.fillRect(-10, -10, W + 20, H + 20);
    }

    // ── Moving layers ─────────────────────────────────────────────────────────
    // moveLayer - slide a layer the level design moves to x, y from where the
    // art draws it, in the level SVG's own units, over duration seconds with
    // the named ease. It sets off from wherever it is now, so a later move to
    // 0, 0 puts it back; an axis given as null stays where it is. The layer is
    // looked for in the scene the player is in, then the ones they went in
    // from. False when none of them was built to move it.
    moveLayer(path, { x = null, y = null, ease = 'linear', duration = 0 } = {}) {
        const stages = [this.stage, ...[...this.stack].reverse().map(frame => frame.stage)];
        for (const stage of stages) {
            const scene = stage?.scene;
            const layer = levelMapFindLayer(scene?.map, path);
            const layers = this.sceneStates.get(scene)?.layers;
            if (!layer || !layers) continue;
            const now = layers.get(layer.id) || { x: 0, y: 0, move: null };
            const { scale } = scene.map;
            now.move = {
                name: layer.name, ease, t: 0, duration: duration > 0 ? duration : 0,
                fromX: now.x, toX: Number.isFinite(x) ? x * scale.x : now.x,
                fromY: now.y, toY: Number.isFinite(y) ? y * scale.y : now.y,
            };
            layers.set(layer.id, now);
            this._stepLayer(now, 0);
            return true;
        }
        return false;
    }

    // layerOffsets - where a scene's moved layers are this run, as layer id ->
    // { x, y } in world px from where the art draws them, or null.
    layerOffsets(scene) {
        return this.sceneStates.get(scene)?.layers || null;
    }

    // Every scene's, not only the current one's: a door sent open stays on its
    // way while the player is inside somewhere else.
    _updateLayers(dt) {
        for (const { layers } of this.sceneStates.values()) {
            for (const layer of layers.values()) {
                if (layer.move) this._stepLayer(layer, dt);
            }
        }
    }

    _stepLayer(layer, dt) {
        const move = layer.move;
        move.t += dt;
        const p = move.duration > 0 ? move.t / move.duration : 1;
        const k = levelLayerEase(move.ease, p);
        layer.x = move.fromX + (move.toX - move.fromX) * k;
        layer.y = move.fromY + (move.toY - move.fromY) * k;
        if (p >= 1) {
            layer.move = null;
            this._report('animate', move.name);
        }
    }

    // ── Animations ────────────────────────────────────────────────────────────
    // An ANIMATE piece is reported once it has had time to show every frame,
    // one full cycle at the rate it is playing, counted from when its scene was
    // entered. A single frame or a held piece never cycles and so is never
    // reported, which is the right answer for art that is not moving.
    _updateAnimations() {
        const elapsed = performance.now() / 1000 - this.sceneStartedAt;
        for (const anim of levelSceneAnimations(this.stage?.scene)) {
            const { mode, fps } = levelAnimSettings(this.stage, anim);
            const cycle = anim.cycleSeconds(mode, fps);
            if (cycle > 0 && elapsed >= cycle) this._report('animate', anim.assetName);
        }
    }
}

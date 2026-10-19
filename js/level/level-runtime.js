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
        this.sceneStates = new Map();   // scene -> { breakables } for this run
        this.fade        = null;        // { phase: 'out' | 'wait' | 'in', t, swap, ready }
        this.active      = null;        // the hotspot the player can use right now
        this._enterScene(stageData);
    }

    update(dt, player) {
        this._updateAnimations();
        for (const piece of this.breakables) {
            if (piece.broken) this._report('break', piece.name);
        }
        if (this.fade) this._updateFade(dt, player);
        else if (player) this._updateHotspots(dt, player);
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
            this.sceneStates.set(scene, { breakables: levelMapBreakables(scene) });
        }
        this.breakables = this.sceneStates.get(scene).breakables;
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
            enterable: h.enterable, rect: h.world, push: h.push,
        }));
        for (const object of map?.objects || []) {
            if (object.children.length) continue;
            spots.push({ kind: 'interact', type: 'interact', id: object.id, key: object.name,
                         rect: object.world, push: null });
        }
        if (this.stack.length && !spots.some(spot => spot.type === 'exit')) {
            spots.push({
                kind: 'enter', type: 'exit', id: 'implicit exit', key: this.stack[this.stack.length - 1].key,
                rect: { x: 0, y: 0, w: LEVEL_IMPLICIT_EXIT_W, h: scene.worldHeight }, push: 'left',
            });
        }
        // Doors before plain interact areas, when the player stands in both.
        return spots.sort((a, b) => (a.kind === 'enter' ? 0 : 1) - (b.kind === 'enter' ? 0 : 1));
    }

    // ── Hotspots ──────────────────────────────────────────────────────────────
    // In reach: the player's centre is over the hotspot, and their feet are
    // within enterDepthTol of its depth span. A door sits above the field, so
    // its reach is the strip of walkable ground at its foot.
    _inReach(spot, player) {
        const cx   = player.x + player.w * 0.5;
        const feet = player.y + player.h;
        const tol  = CFG.enterDepthTol;
        const r    = spot.rect;
        return player.grounded && cx >= r.x && cx <= r.x + r.w
            && feet >= r.y - tol && feet <= r.y + r.h + tol;
    }

    _updateHotspots(dt, player) {
        let active = null;
        for (const spot of this.hotspots) {
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
            this.stack.push({ stage: outer, key: spot.key, door: spot.rect, camX: cam.x,
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
            player.y = door.y + door.h + CFG.enterDepthTol + 4 - player.h;
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
            player.y = r.y + r.h + CFG.enterDepthTol + 4 - player.h;
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
        const label = this.active.kind === 'interact' ? 'E: INTERACT'
                    : this.active.type === 'exit'     ? 'E: EXIT'
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

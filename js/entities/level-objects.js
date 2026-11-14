// js/entities/level-objects.js - live pieces of a level, built from its map
//
// The level map (js/level/level-map.js) says where a piece of level art is and
// what it is. The classes here are what the game draws and plays with.

// ── Animated level art (ANIMATE-<asset-name>) ────────────────────────────────
const LEVEL_ANIM_MODES = ['hold', 'loop', 'yoyo'];

// levelAnimFrameIndex - the frame a piece of level art shows at time t, in
// seconds. The modes mean what they mean for enemies (the "Animation modes"
// notes in js/sprites/enemies.js, and Enemy._enemyPickFrame): hold keeps the
// first frame, loop cycles, and yoyo runs out and back without repeating either
// end, so three frames play 0 1 2 1 and then 0 again. It is a separate helper
// because the enemy picker reads enemy state that level art does not have.
function levelAnimFrameIndex(count, mode, t, fps) {
    if (count <= 1 || !(fps > 0) || mode === 'hold') return 0;
    const step = Math.floor(t * fps);
    if (mode === 'yoyo') {
        const span = (count - 1) * 2;
        const i = step % span;
        return i < count ? i : span - i;
    }
    return step % count;
}

// levelAnimCycleSteps - frames shown in one full cycle, or 0 for art that never
// cycles (one frame, or held).
function levelAnimCycleSteps(count, mode) {
    if (count <= 1 || mode === 'hold') return 0;
    return mode === 'yoyo' ? (count - 1) * 2 : count;
}

const _levelAnimModeWarned = new Set();

// levelAnimSettings - how one piece plays in a stage, as { mode, fps }. The
// stage's levelMap.animate config is read most specific first: the piece's own
// name, the name its frames were found under, then "default", then CFG. An
// unknown mode falls back to the CFG one with a warning, rather than freezing
// the piece on its first frame the way an unknown enemy mode holds.
function levelAnimSettings(stageData, anim) {
    const config = stageData?.levelMap?.animate || {};
    const settings = { ...config.default, ...config[anim.frameName], ...config[anim.assetName] };

    let mode = typeof settings.mode === 'string' ? settings.mode : CFG.levelAnimateMode;
    if (!LEVEL_ANIM_MODES.includes(mode)) {
        if (!_levelAnimModeWarned.has(mode)) {
            _levelAnimModeWarned.add(mode);
            console.warn('[level-map] Unknown animation mode "%s"; use one of %s',
                         mode, LEVEL_ANIM_MODES.join(', '));
        }
        mode = LEVEL_ANIM_MODES.includes(CFG.levelAnimateMode) ? CFG.levelAnimateMode : 'loop';
    }
    const fps = Number.isFinite(settings.fps) && settings.fps > 0 ? settings.fps : CFG.levelAnimateFPS;
    return { mode, fps };
}

// LevelAnimation - one ANIMATE piece: its frames and the world rect they are
// drawn into. It keeps no clock of its own; the caller passes the time, so
// every piece in a level stays in step and pausing leaves them running.
class LevelAnimation {
    constructor(entry) {
        this.id        = entry.id;
        this.assetName = entry.assetName;
        this.frameName = entry.frameName;
        this.rect      = entry.drawWorld;
        // The map read every frame file while finding them, so this is a cache
        // hit rather than another request. Each frame is drawn through the
        // viewBox the map measured, which may be wider than the file's own.
        this.frames = entry.frames.map(path =>
            loadSvgImg(levelMapFrameMarkup(loadSvgText(path), entry.frameViewBox)));
    }

    // cycleSeconds - how long one full cycle takes, or 0 when it never cycles.
    cycleSeconds(mode, fps) {
        const steps = levelAnimCycleSteps(this.frames.length, mode);
        return steps > 0 && fps > 0 ? steps / fps : 0;
    }

    draw(t, settings, offsetX) {
        const { x, y, w, h } = this.rect;
        const sx = x - offsetX;
        if (sx > W || sx + w < 0) return;
        const img = this.frames[levelAnimFrameIndex(this.frames.length, settings.mode, t, settings.fps)];
        if (img && img.naturalWidth) ctx.drawImage(img, sx, y, w, h);
    }
}

// ── Breakable level art (BREAKABLE-<name>) ───────────────────────────────────
// levelSceneBreakableSprites - each breakable's images, keyed by id, decoded
// the first time a scene asks and kept on it. Breakables themselves are made
// fresh for every run (a restart puts a broken gate back), but the 80 KB of
// cut-out markup behind each one is only turned into an image once.
function levelSceneBreakableSprites(scene) {
    if (!scene?.map) return {};
    if (!scene.breakableSprites) {
        scene.breakableSprites = {};
        for (const entry of scene.map.breakables) {
            const state = path => (path ? loadSvgImg(loadSvgText(path)) : null);
            scene.breakableSprites[entry.id] = {
                intact:  loadSvgImg(entry.markup),
                damaged: state(entry.states.damaged),
                broken:  state(entry.states.broken),
            };
        }
    }
    return scene.breakableSprites;
}

// LevelBreakable - a piece of level art that breaks the way a crate does: it
// blocks movement, takes CFG.objBreakHits blows, jolts on each, and bursts on
// the last one in splinters of its own colors. Only where it is, what it looks
// like and how deep it reaches differ from BreakableObj, so that is all this
// overrides. y is its bottom edge, as for a crate.
class LevelBreakable extends BreakableObj {
    constructor(entry, sprites) {
        super(entry.world.x, entry.world.y + entry.world.h);
        this.w = entry.world.w;
        this.h = entry.world.h;
        this.id   = entry.id;
        this.name = entry.name;
        this.breakColors = entry.colors;
        this.sprites = sprites;
        // The cut-out sprite carries a margin for its strokes, so it is drawn
        // into its own slightly larger rect rather than the hit box.
        this.spriteWorld = entry.spriteWorld;
    }

    // Damaged falls back to the piece as it is, which still shakes; broken
    // falls back to nothing at all.
    get img() {
        if (this.broken)   return this.sprites.broken;
        if (this.hits > 0) return this.sprites.damaged || this.sprites.intact;
        return this.sprites.intact;
    }

    // A crate is hit from level with its bottom edge. A piece that spans depth,
    // such as theStreets' gate arm across the lane, can be hit anywhere along
    // that span; with the crate's rule only its last 55 px could.
    inHitDepth(feetY, tol) {
        return feetY > this.y - this.h - tol && feetY < this.y + tol;
    }

    draw() {
        const img = this.img;
        if (!img || !img.naturalWidth) return;
        const ox = this._shakeOffset();
        if (img === this.sprites.intact) {
            const r = this.spriteWorld;
            ctx.drawImage(img, r.x - cam.x + ox, r.y, r.w, r.h);
        } else {
            ctx.drawImage(img, this.x - cam.x + ox, this.y - this.h, this.w, this.h);
        }
    }
}

// ── Items lying in level art (INVENTORY-<item>) ───────────────────────────────
// levelSceneItemSprites - the cut-out art of each item a scene draws itself,
// keyed by id, made once per scene like a breakable's. Items whose layer is
// empty have none: the catalog's art is drawn for them.
function levelSceneItemSprites(scene) {
    if (!scene?.map) return {};
    if (!scene.itemSprites) {
        scene.itemSprites = {};
        for (const entry of scene.map.items || []) {
            if (entry.markup) scene.itemSprites[entry.id] = loadSvgImg(entry.markup);
        }
    }
    return scene.itemSprites;
}

// levelMapItems - fresh items for one run of a scene, as WorldItems
// (js/entities/items.js), each the catalog item its layer names (a
// numbered copy, "coin-2", is a coin). notify hears about a name the item
// catalog does not have; the item still lies there, under its own name.
function levelMapItems(scene, notify = null) {
    const sprites = levelSceneItemSprites(scene);
    return (scene?.map?.items || []).map(entry => {
        const item = typeof itemFor === 'function' ? itemFor(entry.name) : null;
        if (!item && notify) notify(`${entry.id}: the item catalog has no "${entry.name}"`);
        return new WorldItem({
            item: item || entry.name, id: entry.id, box: entry.world,
            x: entry.world.x + entry.world.w * 0.5, y: entry.world.y + entry.world.h,
            sprite: sprites[entry.id] || null, spriteWorld: entry.spriteWorld,
        });
    });
}

// levelMapBreakables - fresh breakables for one run of a scene.
function levelMapBreakables(scene) {
    const sprites = levelSceneBreakableSprites(scene);
    return (scene?.map?.breakables || []).map(entry => new LevelBreakable(entry, sprites[entry.id]));
}

// levelSceneAnimations - a scene's animated pieces, built the first time they
// are asked for and kept on the scene, so a cached scene does not decode its
// frames again on every restart.
function levelSceneAnimations(scene) {
    if (!scene?.map) return [];
    if (!scene.animations) {
        scene.animations = scene.map.animations
            .filter(entry => entry.frames.length && entry.drawWorld)
            .map(entry => new LevelAnimation(entry));
    }
    return scene.animations;
}

// ── Moving level art (a level design's "animate-layers") ─────────────────────
// How a layer travels from where it is to where it was sent, by the names
// LEVEL_DESIGN_VOCAB.values.ease allows. p and the result run 0 to 1.
const LEVEL_LAYER_EASES = {
    'linear':      p => p,
    'ease-in':     p => p * p * p,
    'ease-out':    p => 1 - (1 - p) ** 3,
    'ease-in-out': p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
};

function levelLayerEase(type, p) {
    return (LEVEL_LAYER_EASES[type] || LEVEL_LAYER_EASES.linear)(Math.max(0, Math.min(1, p)));
}

// LevelLayerSlab - one slab of moving layers (see "Moving layers" in
// js/level/level-map.js): the art under them, each layer, and the art above
// each, every image drawn into the slab's one world rect.
class LevelLayerSlab {
    constructor(slab) {
        this.rect    = slab.world;
        this.layers  = slab.layers;
        this.slices  = slab.slices.map(markup => (markup ? loadSvgImg(markup) : null));
        this.sprites = slab.sprites.map(markup => loadSvgImg(markup));
    }

    images() {
        return [...this.slices, ...this.sprites].filter(Boolean);
    }

    // draw - over the background, in paint order. offsets maps a layer id to
    // { x, y }, how far it is from where the art draws it, in world px. A layer
    // never leaves the rect, since the rect was sized to the furthest it goes.
    draw(offsets, offsetX) {
        const { x, y, w, h } = this.rect;
        const sx = x - offsetX;
        if (sx > W || sx + w < 0) return;
        const put = (img, dx = 0, dy = 0) => {
            if (img && img.naturalWidth) ctx.drawImage(img, sx + dx, y + dy, w, h);
        };
        put(this.slices[0]);
        this.layers.forEach((id, i) => {
            const offset = offsets?.get(id);
            put(this.sprites[i], offset?.x || 0, offset?.y || 0);
            put(this.slices[i + 1]);
        });
    }
}

// levelSceneLayerSlabs - a scene's slabs, turned into images the first time
// they are asked for and kept on the scene, as breakable sprites are.
function levelSceneLayerSlabs(scene) {
    if (!scene?.map?.slabs?.length) return [];
    if (!scene.layerSlabs) scene.layerSlabs = scene.map.slabs.map(slab => new LevelLayerSlab(slab));
    return scene.layerSlabs;
}

// levelSceneLayerImages - every image a scene's slabs draw, to wait on before
// the scene is first shown.
function levelSceneLayerImages(scene) {
    return levelSceneLayerSlabs(scene).flatMap(slab => slab.images());
}

// js/entities/items.js - items: the catalog, items lying in a level, and
// what using, combining and taking one does
//
// Items are data. A catalog (config/schema/items.schema.json) lists each one
// by id with its name, its art, what checking it says, how many share a slot,
// and what using or combining it does. The sandbox's catalog is
// config/debug/items.json, named by a test's "items"; a level's own is
// planned. One catalog is in use at a time (useItemCatalog).
//
// A level places an item with an INVENTORY-<item> layer (js/level/level-map.js)
// and the runtime keeps a WorldItem for it per scene, per run. What the player
// carries is an Inventory (js/entities/inventory.js) on the player.
//
// Taking, using and combining are things the player does, so each reports on
// the level map's event bus every time it happens: "take:<item>",
// "use:<item>", "combine:<result>", "drop:<item>". A level design can wait on
// them, and on what is carried with "inventory:<item>" conditions.

const ITEM_CATALOG_SLOTS = 8;

// The catalog in use. Empty until a test (or, later, a level) names one.
let ITEM_CATALOG = _emptyItemCatalog();

function _emptyItemCatalog() {
    return { path: null, slots: ITEM_CATALOG_SLOTS, items: {}, art: {}, warnings: [] };
}

function _itemIsObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const ITEM_USE_ACTIONS = ['heal', 'scatter', 'say'];

// loadItemCatalog - a catalog file read, checked and its art loaded, as
// { path, slots, items, art, warnings }. Never throws: what is wrong is in
// warnings, and an item whose art cannot be read is kept without it.
function loadItemCatalog(path) {
    const catalog = _emptyItemCatalog();
    catalog.path = path;
    const warn = text => catalog.warnings.push(text);
    let data = null;
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.send();
        const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && !!xhr.responseText);
        if (!ok) warn(`${path} could not be read (status ${xhr.status})`);
        else data = JSON.parse(xhr.responseText);
    } catch (e) {
        warn(`${path} could not be read (${e.message})`);
    }
    if (!_itemIsObject(data)) {
        if (data !== null) warn(`${path} is not a JSON object`);
        return catalog;
    }
    if (data.slots !== undefined) {
        if (Number.isInteger(data.slots) && data.slots >= 1) catalog.slots = data.slots;
        else warn('"slots" should be a whole number, 1 or more');
    }
    const items = _itemIsObject(data.items) ? data.items : {};
    if (!_itemIsObject(data.items)) warn('"items" should be an object of items by id');
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    for (const [id, raw] of Object.entries(items)) {
        const at = `item "${id}"`;
        if (!ITEM_ID_RE.test(id)) warn(`${at}: use lower-case letters, digits and - in an item id`);
        if (!_itemIsObject(raw)) {
            warn(`${at} should be an object`);
            continue;
        }
        const def = {
            id,
            name:    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
            look:    typeof raw.look === 'string' ? raw.look : '',
            stack:   Number.isInteger(raw.stack) && raw.stack >= 1 ? raw.stack : 1,
            use:     _itemIsObject(raw.use) ? raw.use : null,
            consume: raw.consume === true,
            combine: _itemIsObject(raw.combine) ? raw.combine : {},
        };
        if (typeof raw.name !== 'string' || !raw.name.trim()) warn(`${at} needs a "name"`);
        if (raw.stack !== undefined && def.stack !== raw.stack) warn(`${at} "stack" should be a whole number, 1 or more`);
        if (raw.use !== undefined) {
            const actions = def.use ? Object.keys(def.use) : [];
            if (actions.length !== 1 || !ITEM_USE_ACTIONS.includes(actions[0])) {
                warn(`${at} "use" should be one of { "heal": <hp> }, { "scatter": <seconds> }, { "say": "<text>" }`);
                def.use = null;
            }
        }
        if (typeof raw.art !== 'string' || !raw.art.trim()) {
            warn(`${at} needs "art", its SVG`);
        } else {
            const artPath = dir + raw.art.trim();
            const text = _readSvgFileSync(artPath);
            if (text === null) warn(`${at}: its art ${artPath} could not be read`);
            else catalog.art[id] = loadSvgImg(text);
            def.artPath = artPath;
        }
        catalog.items[id] = def;
    }
    for (const def of Object.values(catalog.items)) {
        for (const [other, result] of Object.entries(def.combine)) {
            if (!catalog.items[other]) warn(`item "${def.id}" "combine" names "${other}", which is not an item`);
            if (!catalog.items[result]) warn(`item "${def.id}" "combine" makes "${result}", which is not an item`);
        }
    }
    return catalog;
}

// useItemCatalog - make a catalog the one in use; null for none.
function useItemCatalog(catalog) {
    ITEM_CATALOG = catalog || _emptyItemCatalog();
    return ITEM_CATALOG;
}

function itemDef(id) {
    return Object.hasOwn(ITEM_CATALOG.items, id) ? ITEM_CATALOG.items[id] : null;
}

function itemIds() {
    return Object.keys(ITEM_CATALOG.items);
}

function itemArt(id) {
    return ITEM_CATALOG.art[id] || null;
}

function itemName(id) {
    return itemDef(id)?.name || id;
}

// itemCatalogImages - every item's art, to decode before play.
function itemCatalogImages() {
    return Object.values(ITEM_CATALOG.art).filter(Boolean);
}

// itemFor - the item an INVENTORY- layer's name means: the name itself, or
// without Illustrator's numbered-copy ending ("coin-2" is a coin). Null when
// the catalog has neither.
function itemFor(name) {
    const text = String(name ?? '');
    if (itemDef(text)) return text;
    const base = text.replace(/-\d+$/, '');
    return itemDef(base) ? base : null;
}

// ── In the world ──────────────────────────────────────────────────────────────
// WorldItem - an item lying in a scene. x is the middle of where it lies and
// y the ground under it, so it sorts with characters by its feet. Art cut out
// of the level (sprite) is drawn where the level drew it; otherwise the
// catalog's art stands on the spot, bobbing, with a glint every two seconds
// so it reads as something to look at.
const WORLD_ITEM_SIZE  = 28;
const WORLD_ITEM_GLINT = 2;      // seconds between glints
const WORLD_ITEM_GLINT_TIME = 0.35;

class WorldItem {
    constructor({ item, x, y, id = null, box = null, sprite = null, spriteWorld = null, dropped = false }) {
        this.item  = item;
        this.x     = x;
        this.y     = y;
        this.id    = id || `dropped ${item}`;
        this.sprite = sprite;
        this.spriteWorld = spriteWorld;
        this.dropped = dropped;
        this.taken = false;
        this.t     = Math.random() * WORLD_ITEM_GLINT;
        // Where it can be reached from, as a door's rect is.
        this.box   = box || { x: x - WORLD_ITEM_SIZE * 0.5, y: y - WORLD_ITEM_SIZE, w: WORLD_ITEM_SIZE, h: WORLD_ITEM_SIZE };
    }

    update(dt) { this.t += dt; }

    draw() {
        if (this.taken) return;
        if (this.sprite && this.spriteWorld) {
            const r = this.spriteWorld;
            if (this.sprite.naturalWidth) ctx.drawImage(this.sprite, r.x - cam.x, r.y, r.w, r.h);
            this._glint(r.x + r.w - cam.x - 4, r.y + 4);
            return;
        }
        const sx = this.x - cam.x;
        const bob = Math.sin(this.t * 4) * 3;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(sx, this.y, 11, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const img = itemArt(this.item);
        const top = this.y - WORLD_ITEM_SIZE - 4 + bob;
        if (img && img.naturalWidth) ctx.drawImage(img, sx - WORLD_ITEM_SIZE * 0.5, top, WORLD_ITEM_SIZE, WORLD_ITEM_SIZE);
        this._glint(sx + 9, top + 3);
    }

    // _glint - a four-point star that swells and shrinks once a cycle.
    _glint(x, y) {
        const phase = this.t % WORLD_ITEM_GLINT;
        if (phase > WORLD_ITEM_GLINT_TIME) return;
        const s = Math.sin(phase / WORLD_ITEM_GLINT_TIME * Math.PI) * 6;
        ctx.save();
        ctx.fillStyle = 'rgba(255,248,214,0.95)';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.25, y - s * 0.25);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x + s * 0.25, y + s * 0.25);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 0.25, y + s * 0.25);
        ctx.lineTo(x - s, y);
        ctx.lineTo(x - s * 0.25, y - s * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ── Doing things with items ───────────────────────────────────────────────────
// itemUse - use one of an item the player carries: what its "use" says, one
// used up when it is "consume". Returns { used, text }, text being what to
// say either way. Reports "use:<item>" when it did something.
function itemUse(p, id) {
    const def = itemDef(id);
    if (!def) return { used: false, text: 'There is no such thing.' };
    if (!p?.inventory?.has(id)) return { used: false, text: `You do not have the ${def.name}.` };
    const use = def.use;
    let result;
    if (!use) {
        result = { used: false, text: `There is nothing to use the ${def.name} on here.` };
    } else if (use.heal !== undefined) {
        if (p.hp >= p.maxHp) {
            result = { used: false, text: `You are fine. Keep the ${def.name} for later.` };
        } else {
            p.hp = Math.min(p.maxHp, p.hp + use.heal);
            if (typeof _hpHUD === 'function') _hpHUD(p);
            result = { used: true, text: 'You feel better.' };
        }
    } else if (use.scatter !== undefined) {
        const scattered = itemScatter(use.scatter);
        result = { used: true, text: scattered ? `You use the ${def.name}. They scatter!`
                                               : `You use the ${def.name}. Nobody is here to care.` };
    } else {
        result = { used: true, text: use.say };
    }
    if (result.used) {
        if (def.consume) p.inventory.remove(id, 1);
        levelMapEmit('use', id);
    }
    return result;
}

// itemScatter - every enemy fighting in the scene runs off the nearer edge of
// the view, waits there for seconds, and walks back in at the same edge, 60
// px inside the view as it is by then, to take up the fight. Enemies walking
// out of a door, running off for good, or already away are left alone, and
// so is anyone kept in another scene. Returns how many went.
function itemScatter(seconds) {
    const stage = typeof getCurrentStageData === 'function' ? getCurrentStageData() : null;
    const fighting = enemies.filter(e => !e.dead && !e.fled && !e.fleeing && !e.script);
    for (const enemy of fighting) {
        const side = levelDesignNearerSide(enemy);
        const run = enemy.speed * CFG.enemySpeedMultiplier;
        enemy.scattered = true;
        enemy.queueScript({ walk: e => levelDesignOffView(e, side), speed: run * CFG.enemyFleeSpeed, face: 'travel' });
        enemy.queueScript({ wait: Math.max(0, seconds) });
        enemy.queueScript({
            walk: e => {
                const feet = _levelDesignFieldPoint(stage, {
                    x: side < 0 ? cam.x + 60 + e.w * 0.5 : cam.x + W - 60 - e.w * 0.5,
                    y: e.y + e.h,
                });
                return { x: feet.x - e.w * 0.5, y: feet.y - e.h };
            },
            speed: run,
        });
        enemy.queueScript({ call: e => { e.scattered = false; } });
    }
    return fighting.length;
}

// itemCombine - put two carried items together, by either one's "combine".
// Both are used up and the result takes the first one's slot (or a slot of
// its own when the first was one of a stack). Returns { made, text }; made is
// the result's id, or null. Reports "combine:<result>".
function itemCombine(p, a, b) {
    const inv = p?.inventory;
    if (!inv || a === b || !inv.has(a) || !inv.has(b)) return { made: null, text: 'They do not go together.' };
    const made = itemDef(a)?.combine?.[b] || itemDef(b)?.combine?.[a] || null;
    if (!made || !itemDef(made)) return { made: null, text: 'They do not go together.' };
    inv.remove(b, 1);
    const index = inv.items.findIndex(slot => slot.item === a);
    if (index >= 0 && inv.items[index].count === 1) {
        inv.replaceAt(index, made, 1);
    } else {
        inv.remove(a, 1);
        inv.add(made, 1);
    }
    levelMapEmit('combine', made);
    return { made, text: `Combined: ${itemName(made)}.` };
}

// itemTake - put an item lying in the world into the player's hands, if
// there is room. Returns { taken, text }. Reports "take:<item>".
function itemTake(p, worldItem) {
    const def = itemDef(worldItem?.item);
    if (!def || worldItem.taken) return { taken: false, text: 'There is nothing there to take.' };
    if (!p?.inventory || p.inventory.room(def.id) < 1) return { taken: false, text: `No room for the ${def.name}.` };
    p.inventory.add(def.id, 1);
    worldItem.taken = true;
    levelMapEmit('take', def.id);
    return { taken: true, text: `You took the ${def.name}.` };
}

// itemOffer - E at an item lying in the world: what it is, and whether to
// take it, in the message window (GameUI), with the game paused.
function itemOffer(p, worldItem) {
    const def = itemDef(worldItem?.item);
    if (!def || typeof GameUI === 'undefined') return;
    GameUI.message({
        art: itemArt(def.id),
        text: def.look || `A ${def.name}.`,
        ask: `Take the ${def.name}?`,
        choices: ['YES', 'NO'],
        onChoose: choice => {
            if (choice !== 0) return;
            GameUI.message({ art: itemArt(def.id), text: itemTake(p, worldItem).text });
        },
    });
}

// js/level/level-map.js - level behavior read from the ids of a level SVG
//
// Level art is drawn in Illustrator, and a layer's name becomes the id of what
// it exports. The engine already reads two of those ids: #field, the walkable
// area, and the border rects that slice a level into screens. This file reads
// the rest of the vocabulary, so a level gains a door, a breakable gate or an
// animated sign by how its layers are named rather than by coordinates typed
// into code:
//
//   ENTERABLE-<name>        something that can be entered (a building, a car)
//   RESTRICTED-<name>       an ENTERABLE that starts locked
//     REQUIRE-case-<case>   what unlocks it: a level-design case that is true,
//     REQUIRE-state-<state> or a state that has been entered. May be an empty
//                           layer. (REQUIRE-item-<item> is reserved.)
//     ENTER-<type>          its entry hotspot; <type> picks what entering does
//   OBJECT-<name>           an area holding something to interact with
//     ANIMATE-<asset-name>  drawn from frames <asset-name>_0.svg, _1, ...
//     BREAKABLE-<name>      cut out of the art; takes hits and breaks
//   EVENT-<name>            a trigger area; the player walking in reports it
//   negative-space          a hole in #field that nobody can walk into
//
// INVENTORY-, MISSING-, SWITCH- and USABLE- are reserved: recognised, listed,
// and warned about once, so a level can be named for them before they work.
//
// The upper-case prefixes are matched case-sensitively, so ordinary art names
// such as "enter-sign" or "object-shadow" never turn into behavior. The
// separator after a prefix may be - or _, because Illustrator can export a
// space in a layer name as an underscore.
//
// parseLevelMap only reads. What an entry does at runtime lives with the code
// that runs it, and features report what happened through LEVEL_MAP_EVENTS,
// which is where the sandbox checklist listens.

// Tested in order. ENTERABLE comes before ENTER for clarity only: "ENTER-"
// cannot match "ENTERABLE-", since the character after ENTER must be the
// separator.
// RESTRICTED is an enterable that starts locked, so it shares the enterable
// kind: a door inside it finds it as its enterable, and its interior is looked
// up the same way.
const LEVEL_MAP_RULES = [
    { kind: 'enterable', label: 'ENTERABLE',      re: /^ENTERABLE[-_](.+)$/ },
    { kind: 'enterable', label: 'RESTRICTED',     re: /^RESTRICTED[-_](.+)$/, restricted: true },
    { kind: 'require',   label: 'REQUIRE',        re: /^REQUIRE[-_](.+)$/ },
    { kind: 'hotspot',   label: 'ENTER',          re: /^ENTER[-_](.+)$/ },
    { kind: 'object',    label: 'OBJECT',         re: /^OBJECT[-_](.+)$/ },
    { kind: 'animate',   label: 'ANIMATE',        re: /^ANIMATE[-_](.+)$/ },
    { kind: 'breakable', label: 'BREAKABLE',      re: /^BREAKABLE[-_](.+)$/ },
    { kind: 'event',     label: 'EVENT',          re: /^EVENT[-_](.+)$/ },
    { kind: 'reserved',  label: 'INVENTORY',      re: /^INVENTORY[-_](.+)$/ },
    { kind: 'reserved',  label: 'MISSING',        re: /^MISSING[-_](.+)$/ },
    { kind: 'reserved',  label: 'SWITCH',         re: /^SWITCH[-_](.+)$/ },
    { kind: 'reserved',  label: 'USABLE',         re: /^USABLE[-_](.+)$/ },
    { kind: 'hole',      label: 'negative-space', re: /^negative-space(?:[-_]\d+)?$/ },
];

// What a REQUIRE- layer can wait on, as REQUIRE-<type>-<name>. "item" is
// reserved until there is an inventory.
const LEVEL_MAP_REQUIRE_TYPES = ['case', 'state', 'item'];
const LEVEL_MAP_REQUIRE_RE = /^([a-z]+)[-_](.+)$/;

// What an ENTER hotspot can name as its type. Anything else is reported rather
// than quietly treated as a building.
const LEVEL_MAP_ENTER_TYPES = ['building', 'vehicle', 'exit'];

// An id shaped like a map id that matches no rule, such as "ANIMTE-sign". It is
// reported because the likeliest reason is a typo, and a typo here means a door
// or a breakable that silently never works.
const LEVEL_MAP_UNKNOWN_RE = /^[A-Z]{3,}[-_]/;

// Room left around a cut-out sprite, in SVG units. getBBox measures geometry
// without its stroke, and theStreets has strokes up to 10 units wide, so a
// sprite cut to the bare box would shave half of every edge stroke off.
const LEVEL_MAP_SPRITE_PAD = 6;

// ── Event bus ─────────────────────────────────────────────────────────────────
// Every level-map feature reports here as "<kind>:<key>", such as
// "break:parking-gate-arm" or "enter:bad-bar". Listeners read
// event.detail.event, or detail.kind and detail.key separately.
const LEVEL_MAP_EVENTS = new EventTarget();

function levelMapEmit(kind, key) {
    const event = `${kind}:${key}`;
    LEVEL_MAP_EVENTS.dispatchEvent(new CustomEvent('levelmap', { detail: { kind, key, event } }));
}

// levelMapRule - which rule an id falls under, as { kind, label, name }, or
// null. name is the part after the prefix; for a hole it is the whole id.
function levelMapRule(id) {
    for (const rule of LEVEL_MAP_RULES) {
        const match = rule.re.exec(id);
        if (match) return { kind: rule.kind, label: rule.label, name: match[1] || id, restricted: !!rule.restricted };
    }
    return null;
}

// ── Finding a layer by path ───────────────────────────────────────────────────
// A level design names places by layer path, not coordinates:
//
//   "ENTER-building"                                     any door of that name
//   "RESTRICTED-import-export-warehouse/ENTER-building"  the one whose nearest
//                                                        mapped parent is that
//
// Each part matches an id exactly or with Illustrator's "-<n>" duplicate
// suffix, so "ENTER-building" also finds "ENTER-building-2". Parents are
// matched up the chain of mapped ancestors, nearest first.

function _levelMapEscape(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _levelMapIdMatches(id, part) {
    return new RegExp(`^${_levelMapEscape(part)}(?:-\\d+)?$`).test(id);
}

// levelMapFindAll - every region the path names, in document order.
function levelMapFindAll(map, path) {
    const parts = String(path || '').split('/').map(part => part.trim()).filter(Boolean);
    if (!map || !parts.length) return [];
    const byId = new Map(map.regions.map(region => [region.id, region]));
    const target = parts[parts.length - 1];
    return map.regions.filter(region => {
        if (!_levelMapIdMatches(region.id, target)) return false;
        let node = region;
        for (let i = parts.length - 2; i >= 0; i--) {
            node = node.parent ? byId.get(node.parent) : null;
            if (!node || !_levelMapIdMatches(node.id, parts[i])) return false;
        }
        return true;
    });
}

// levelMapFind - the first region a path names, or null. A region without a
// place (a REQUIRE- layer) is never returned, since a path is asked for so
// something can be put there.
function levelMapFind(map, path) {
    return levelMapFindAll(map, path).find(region => region.world) || null;
}

// ── Measuring ─────────────────────────────────────────────────────────────────
// _levelMapMount - the level SVG mounted where the browser will lay it out, so
// getBBox, getCTM and getComputedStyle can answer about it.
//
// The host is hidden with visibility and parked off screen rather than given
// display:none, because a display:none subtree has no layout and getBBox reports
// zeros for all of it. The root is sized to its own viewBox so getCTM maps
// straight to viewBox units, give or take the viewBox origin. It sits in a
// shadow root so the level's <style> block cannot restyle the page, and the
// page's stylesheet cannot reach in and change what is measured.
function _levelMapMount(svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const source = doc.documentElement;
    if (!source || source.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;

    const vb = _svgSceneViewBox(source);
    const root = document.importNode(source, true);
    root.setAttribute('width', String(vb.width));
    root.setAttribute('height', String(vb.height));

    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-100000px;top:0;width:0;height:0;'
                       + 'overflow:hidden;visibility:hidden;pointer-events:none';
    host.attachShadow({ mode: 'open' }).appendChild(root);
    document.body.appendChild(host);
    return { doc, root, vb, unmount: () => host.remove() };
}

// getCTM maps into the mounted root's viewport, which sits at the viewBox
// origin. Shifting by that origin gives viewBox (user) units, the coordinates
// #field and every other shape in the file are written in.
function _levelMapToUser(ctm, vb) {
    return new DOMMatrix([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e + vb.x, ctm.f + vb.y]);
}

// _levelMapBox - an element's axis-aligned box in viewBox units, with its own
// transform and every ancestor's applied. Null for an element with nothing to
// measure, such as an empty group.
function _levelMapBox(el, vb) {
    let bbox, ctm;
    try {
        bbox = el.getBBox();
        ctm  = el.getCTM();
    } catch (e) {
        return null;
    }
    if (!ctm || (bbox.width <= 0 && bbox.height <= 0)) return null;

    const m = _levelMapToUser(ctm, vb);
    const corners = [
        [bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y],
        [bbox.x, bbox.y + bbox.height], [bbox.x + bbox.width, bbox.y + bbox.height],
    ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    const xs = corners.map(p => p.x);
    const ys = corners.map(p => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

// _levelMapWorld - a viewBox box placed in the world, as { x, y, w, h }. It goes
// through the same normalization as #field and the background image, which is
// stretched over the whole world, so whatever is placed with it lands exactly
// where the background drew it.
function _levelMapWorld(box, vb, worldWidth, worldHeight) {
    const n = _svgSceneNormalizedBounds(box, vb);
    if (!n) return null;
    return { x: n.x * worldWidth, y: n.y * worldHeight, w: n.width * worldWidth, h: n.height * worldHeight };
}

function _levelMapPad(box, pad) {
    return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
}

// _levelMapMappedAncestor - the nearest enclosing element whose id is a map id
// of the given kind (or of any kind), or null.
function _levelMapMappedAncestor(el, root, kind = null) {
    for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
        const id = (node.getAttribute('id') || '').trim();
        const rule = id && levelMapRule(id);
        if (rule && (!kind || rule.kind === kind)) return { id, name: rule.name };
    }
    return null;
}

// ── Cut-out sprites ───────────────────────────────────────────────────────────
// _levelMapParentMatrix - what the element's ancestors do to it, in viewBox
// units, so a cut-out copy can be wrapped in the same transform and land where
// the original was.
function _levelMapParentMatrix(el, root, vb) {
    const parent = el.parentElement;
    if (!parent || parent === root || !parent.getCTM) return new DOMMatrix();
    const ctm = parent.getCTM();
    return ctm ? _levelMapToUser(ctm, vb) : new DOMMatrix();
}

// _levelMapSpriteMarkup - a standalone SVG of one element, framed by spriteBox.
// The file's <defs> come along because exported art takes its fills from .cls-N
// rules and gradients defined there. Presentation set on an ancestor group,
// rather than on the element or through a class, does not; Illustrator's
// exports keep styling on the shapes themselves.
function _levelMapSpriteMarkup(el, spriteBox, defsMarkup, matrix) {
    const { a, b, c, d, e, f } = matrix;
    const { x, y, width, height } = spriteBox;
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
         + `viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">`
         + defsMarkup
         + `<g transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})">`
         + new XMLSerializer().serializeToString(el)
         + '</g></svg>';
}

// _levelMapColors - the fill colors of the shapes an element is made of, for
// splinters that match the thing that broke. Only leaf shapes count: a group
// reports the black it inherits, not what it looks like. A shape with no fill
// of its own also computes to black, so black is kept only when it is all
// there is. Gradient fills have no single color and are skipped.
function _levelMapColors(el) {
    const nodes = el.children.length ? Array.from(el.querySelectorAll('*')) : [el];
    const fills = new Set();
    for (const node of nodes) {
        if (node.children.length) continue;
        const fill = getComputedStyle(node).fill;
        if (fill && fill !== 'none' && !fill.startsWith('url(')) fills.add(fill);
    }
    const all = [...fills];
    const lit = all.filter(color => color !== 'rgb(0, 0, 0)');
    return (lit.length ? lit : all).slice(0, 8);
}

// ── Holes ─────────────────────────────────────────────────────────────────────
// _levelMapHolePoints - a negative-space outline, normalized to the viewBox the
// same way #field is, so the two can be intersected directly. A shape other
// than a rect, polygon or polyline falls back to its box.
function _levelMapHolePoints(el, box, vb, warn) {
    const local = _svgSceneShapePoints(el);
    let points;
    if (local.length >= 3) {
        const m = _levelMapToUser(el.getCTM(), vb);
        points = local.map(p => new DOMPoint(p.x, p.y).matrixTransform(m));
    } else {
        warn(`${el.getAttribute('id')} is a <${el.tagName.toLowerCase()}>; `
           + 'negative-space reads rect, polygon or polyline, so its box is used instead');
        points = [
            { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
            { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height },
        ];
    }
    return points.map(p => ({ x: (p.x - vb.x) / vb.width, y: (p.y - vb.y) / vb.height }));
}

// ── Animation frames ──────────────────────────────────────────────────────────
// Longest numbered run one ANIMATE piece may expand to, the same cap the enemy
// loader uses (ENEMY_RANGE_LIMIT): plenty for drawn animation, and a typo can
// not stall a level load on a long run of missing files.
const LEVEL_MAP_FRAME_LIMIT = 64;

// _levelMapReadSvg - a file's text, or null when it is not there. Found files
// go into the loader's cache, so turning frames into images reads nothing twice.
function _levelMapReadSvg(path) {
    if (_svgTextCache.has(path)) return _svgTextCache.get(path);
    const text = _readSvgFileSync(path);
    if (text !== null) _svgTextCache.set(path, text);
    return text;
}

// _levelMapFrameRun - "<base>_0.svg", "<base>_1.svg", ... for as long as they
// exist. The run starts at 0 and stops at the first gap, as the enemy loader's
// numbered ranges do, so a stray "_7.svg" never joins a 0..2 animation.
function _levelMapFrameRun(base) {
    const paths = [];
    for (let i = 0; i < LEVEL_MAP_FRAME_LIMIT; i++) {
        const path = `${base}_${i}.svg`;
        if (_levelMapReadSvg(path) === null) break;
        paths.push(path);
    }
    return paths;
}

// _levelMapFrames - the frame files for one ANIMATE piece, as { name, paths }.
// First found wins: a numbered run in the level's own objects/ folder, the
// same run in the shared assets/objects/, then a single file in either. A
// name that finds nothing is tried again without a trailing "-<n>", the suffix
// Illustrator gives a duplicated layer, so a copied sign shares its frames.
function _levelMapFrames(assetName, levelDir) {
    const names = [assetName];
    const unsuffixed = assetName.replace(/-\d+$/, '');
    if (unsuffixed !== assetName) names.push(unsuffixed);

    for (const name of names) {
        const folders = [`${levelDir}objects/`, 'assets/objects/'];
        for (const folder of folders) {
            const run = _levelMapFrameRun(folder + name);
            if (run.length) return { name, paths: run };
        }
        for (const folder of folders) {
            const single = `${folder}${name}.svg`;
            if (_levelMapReadSvg(single) !== null) return { name, paths: [single] };
        }
    }
    return { name: assetName, paths: [] };
}

// _levelMapFramePlacement - where a frame is drawn, as { drawBox, viewBox }:
// drawBox in the level's viewBox units, so the frame's art lands on the
// element it replaces, and viewBox the frame's own viewBox to draw it with.
//
// Frames are exported on their own artboard, padded differently from the
// level, so the frame's content box is lined up with the element's content
// box, scaled by their widths. Both are measured in this browser with the same
// fonts, so a sign set in a font the browser lacks still lines up: the fallback
// font is wider, but it is equally wider in both.
//
// Wider is also why the viewBox can grow. A frame's viewBox crops whatever
// falls outside it, and theStreets' sign is set in Myriad Pro, which a browser
// without it replaces with a font wide enough that the R of "BAD BAR" falls off
// the artboard. The viewBox is widened to take in the content (plus stroke
// room), and the draw rect with it. When the frame cannot be measured at all,
// its viewBox is stretched over the element instead.
function _levelMapFramePlacement(frameText, box) {
    const mount = _levelMapMount(frameText);
    if (!mount) return { drawBox: { ...box }, viewBox: null };
    try {
        const { root, vb } = mount;
        const parts = Array.from(root.children)
            .filter(el => !['defs', 'style', 'title', 'desc', 'metadata'].includes(el.tagName.toLowerCase()))
            .map(el => _levelMapBox(el, vb))
            .filter(Boolean);
        if (!parts.length) return { drawBox: { ...box }, viewBox: null };
        const minX = Math.min(...parts.map(p => p.x));
        const minY = Math.min(...parts.map(p => p.y));
        const maxX = Math.max(...parts.map(p => p.x + p.width));
        const maxY = Math.max(...parts.map(p => p.y + p.height));
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const scale = contentW > 0 ? box.width / contentW : (contentH > 0 ? box.height / contentH : 0);
        if (!(scale > 0)) return { drawBox: { ...box }, viewBox: null };

        const pad = LEVEL_MAP_SPRITE_PAD;
        const left   = Math.min(vb.x, minX - pad);
        const top    = Math.min(vb.y, minY - pad);
        const right  = Math.max(vb.x + vb.width, maxX + pad);
        const bottom = Math.max(vb.y + vb.height, maxY + pad);
        const viewBox = { x: left, y: top, width: right - left, height: bottom - top };
        return {
            drawBox: {
                x: box.x + (viewBox.x - minX) * scale,
                y: box.y + (viewBox.y - minY) * scale,
                width: viewBox.width * scale,
                height: viewBox.height * scale,
            },
            viewBox,
        };
    } finally {
        mount.unmount();
    }
}

// _levelMapStateSprite - "<levelDir>objects/<name>_<state>.svg" when that file
// exists, else null. State art is drawn over the breakable's own box, the way
// the crate's intact, damaged and broken sprites share one size, so it is
// exported on an artboard the size of the piece it replaces.
function _levelMapStateSprite(levelDir, name, state) {
    const path = `${levelDir}objects/${name}_${state}.svg`;
    return _levelMapReadSvg(path) === null ? null : path;
}

// levelMapFrameMarkup - a frame's SVG text with its viewBox replaced, and any
// width or height dropped so its authored size is that viewBox. Null keeps the
// file as it is.
function levelMapFrameMarkup(frameText, viewBox) {
    if (!viewBox) return frameText;
    const doc = new DOMParser().parseFromString(frameText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || doc.querySelector('parsererror')) return frameText;
    root.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    root.removeAttribute('width');
    root.removeAttribute('height');
    return new XMLSerializer().serializeToString(doc);
}

// ── Moving layers ─────────────────────────────────────────────────────────────
// A level design can slide any piece of the art, such as a door's two panes of
// glass, by naming its layer under a state's "animate-layers". Those layers
// are asked for when the scene is built (parseLevelMap's layers option),
// because the background image has to be made without them.
//
// A layer cut out and drawn on top would lose its place in the stacking order:
// the door frame Illustrator draws over the glass would end up under it. So
// the area a layer can move through, its box widened by the furthest the
// design sends it, is drawn again in slices instead. Layers whose areas
// overlap share one area, a slab, and its slices are the art under the first
// layer, then each layer followed by the art above it, all cropped to the slab:
//
//   background, with the layers cut out
//   slab:  under | layer 1 | between | layer 2 | over
//
// The under slice paints the same art over the background there, so a slab
// at rest is the level as drawn. Live pieces (ANIMATE, BREAKABLE) are left out
// of every slice, since they are drawn on their own.
//
// A slice is its own image, so an element above a layer that uses
// mix-blend-mode blends with nothing inside its slice rather than with the art
// below it. For the black drop shadows Illustrator exports, that looks the same.

// Elements that draw nothing themselves but that drawn ones refer to. Every
// slice keeps them as they are.
const LEVEL_MAP_NON_RENDER = new Set([
    'defs', 'style', 'title', 'desc', 'metadata', 'clippath', 'mask',
    'lineargradient', 'radialgradient', 'pattern', 'symbol', 'filter', 'marker',
]);

// levelMapLayerPath - a layer path written the one way it is compared:
// "ENTER-building / door-glass-left" is "ENTER-building/door-glass-left".
function levelMapLayerPath(path) {
    return String(path ?? '').split('/').map(part => part.trim()).filter(Boolean).join('/');
}

// levelMapFindLayer - the moving layer a level design names by path, as the
// map's layers entry, or null when the scene was not built to move it.
function levelMapFindLayer(map, path) {
    const wanted = levelMapLayerPath(path);
    return map?.layers?.find(layer => layer.paths.includes(wanted)) || null;
}

// _levelMapNames - an element's id and its data-name, which is the name the
// layer had in Illustrator before a copy of it was numbered.
function _levelMapNames(el) {
    return [el.getAttribute('id'), el.getAttribute('data-name')]
        .map(name => (name || '').trim())
        .filter(Boolean);
}

// _levelMapArtMatches - every element a layer path names, in document order.
// Unlike a map path, it can name any layer of the art. The last part is the
// layer's id or data-name, either with or without Illustrator's "-<n>" copy
// suffix. Each part before it is an ancestor further up, in order, with any
// number of groups in between, so "ENTER-building/door-glass-left" finds the
// glass inside that door's "doors" group.
function _levelMapArtMatches(root, path) {
    const parts = levelMapLayerPath(path).split('/').filter(Boolean);
    if (!parts.length) return [];
    const named = (el, part) => _levelMapNames(el).some(name => _levelMapIdMatches(name, part));
    return Array.from(root.querySelectorAll('[id]')).filter(el => {
        if (el.closest('defs') || !named(el, parts[parts.length - 1])) return false;
        let node = el.parentElement;
        for (let i = parts.length - 2; i >= 0; i--) {
            while (node && node !== root && !named(node, parts[i])) node = node.parentElement;
            if (!node || node === root) return false;
            node = node.parentElement;
        }
        return true;
    });
}

function _levelMapOverlaps(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function _levelMapUnion(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
        x, y,
        width:  Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y,
    };
}

// _levelMapSnapBox - a viewBox box grown out to whole world pixels, so a slab
// starts and ends on the same pixel edges as the background under it.
function _levelMapSnapBox(box, vb, worldWidth, worldHeight) {
    const sx = worldWidth / vb.width;
    const sy = worldHeight / vb.height;
    const left   = Math.floor((box.x - vb.x) * sx);
    const top    = Math.floor((box.y - vb.y) * sy);
    const right  = Math.ceil((box.x + box.width - vb.x) * sx);
    const bottom = Math.ceil((box.y + box.height - vb.y) * sy);
    return { x: vb.x + left / sx, y: vb.y + top / sy, width: (right - left) / sx, height: (bottom - top) / sy };
}

// _levelMapSweep - the area a layer can be drawn in: its box, widened by the
// furthest the design moves it each way, plus stroke room.
function _levelMapSweep(entry) {
    const { box, reach } = entry;
    const pad = LEVEL_MAP_SPRITE_PAD;
    return {
        x: box.x + reach.minX - pad,
        y: box.y + reach.minY - pad,
        width:  box.width + reach.maxX - reach.minX + pad * 2,
        height: box.height + reach.maxY - reach.minY + pad * 2,
    };
}

// _levelMapSliceMarkup - the level, keeping only what keep() picks out, the
// groups those sit in, and what every slice keeps, cropped to box. The groups
// come along whole, attributes and all, so a transform, class or opacity set
// on one still applies.
function _levelMapSliceMarkup(text, keep, box) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    const prune = parent => {
        for (const el of Array.from(parent.children)) {
            if (LEVEL_MAP_NON_RENDER.has(el.tagName.toLowerCase()) || keep(el)) continue;
            if (el.hasAttribute('data-level-hold')) prune(el);
            else el.remove();
        }
    };
    prune(svg);
    svg.querySelectorAll('[data-level-skip]').forEach(el => el.remove());
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    return new XMLSerializer().serializeToString(doc);
}

// _levelMapSlab - the slices of one slab, as { slices, sprites }: slices[0] is
// the art under the first layer and slices[i + 1] the art after layer i, null
// when there is none; sprites[i] is layer i on its own. All are cropped to
// region, so each draws into the slab's one world rect.
//
// Art is sorted into slices by document order, which is paint order: walking
// the file, each element goes in the slice of the layers passed so far. The
// groups a layer sits in are walked into rather than sorted whole, since they
// hold art on both sides of it. Only art that reaches into the region is kept.
function _levelMapSlab(root, vb, layerEls, region, skip) {
    const holders = new Set();
    for (const el of layerEls) {
        for (let node = el.parentElement; node && node !== root; node = node.parentElement) holders.add(node);
    }
    const bands = [[], ...layerEls.map(() => [])];
    let passed = 0;
    const visit = parent => {
        for (const el of Array.from(parent.children)) {
            if (LEVEL_MAP_NON_RENDER.has(el.tagName.toLowerCase())) continue;
            const index = layerEls.indexOf(el);
            if (index >= 0) {
                passed = index + 1;
                continue;
            }
            if (holders.has(el)) {
                visit(el);
                continue;
            }
            if (skip.has(el)) continue;
            const box = _levelMapBox(el, vb);
            if (box && _levelMapOverlaps(_levelMapPad(box, LEVEL_MAP_SPRITE_PAD), region)) bands[passed].push(el);
        }
    };
    visit(root);

    // Marked, serialized once, and unmarked: each slice is cut from that one
    // copy by its marks.
    const marked = [];
    const mark = (el, name, value = '') => {
        el.setAttribute(name, value);
        marked.push([el, name]);
    };
    bands.forEach((list, k) => list.forEach(el => mark(el, 'data-level-slice', String(k))));
    layerEls.forEach((el, i) => mark(el, 'data-level-layer', String(i)));
    holders.forEach(el => mark(el, 'data-level-hold'));
    skip.forEach(el => mark(el, 'data-level-skip'));
    const text = new XMLSerializer().serializeToString(root);
    marked.forEach(([el, name]) => el.removeAttribute(name));

    return {
        slices: bands.map((list, k) => (list.length
            ? _levelMapSliceMarkup(text, el => el.getAttribute('data-level-slice') === String(k), region)
            : null)),
        sprites: layerEls.map((_, i) =>
            _levelMapSliceMarkup(text, el => el.getAttribute('data-level-layer') === String(i), region)),
    };
}

// _levelMapMovingLayers - find, measure and slice the layers a level design
// moves. requests is [{ path, reach: { minX, maxX, minY, maxY } }], reach in
// viewBox units: how far left, right, up and down the design sends the layer.
// Each request is recorded under map.layerRequests with what went wrong, if
// anything, for the level design's checks to report against the design.
function _levelMapMovingLayers(map, root, vb, requests, worldWidth, worldHeight) {
    const all = Array.from(root.querySelectorAll('[id]')).filter(el => !el.closest('defs'));
    const strip = new Set(map.stripIds);
    const live = all.filter(el => strip.has(el.getAttribute('id').trim()));
    const found = [];   // { el, entry }, one per element

    for (const request of requests) {
        const path = levelMapLayerPath(request?.path);
        if (!path || map.layerRequests.some(r => r.path === path)) continue;
        const record = { path, problem: null, matches: 0 };
        map.layerRequests.push(record);
        const matches = _levelMapArtMatches(root, path);
        record.matches = matches.length;
        const el = matches[0];
        const reach = { minX: 0, maxX: 0, minY: 0, maxY: 0, ...request.reach };
        if (!el) {
            record.problem = 'missing';
            continue;
        }
        const piece = live.find(other => other === el || other.contains(el) || el.contains(other));
        if (piece) {
            record.problem = `it ${el.contains(piece) && piece !== el ? 'holds' : 'is part of'} `
                           + `${piece.getAttribute('id')}, which is drawn on its own`;
            continue;
        }
        const same = found.find(item => item.el === el);
        if (same) {
            // Two paths to one layer: one layer, moved as far as either sends it.
            same.entry.paths.push(path);
            const r = same.entry.reach;
            same.entry.reach = {
                minX: Math.min(r.minX, reach.minX), maxX: Math.max(r.maxX, reach.maxX),
                minY: Math.min(r.minY, reach.minY), maxY: Math.max(r.maxY, reach.maxY),
            };
            continue;
        }
        const nested = found.find(item => item.el.contains(el) || el.contains(item.el));
        if (nested) {
            record.problem = `it ${nested.el.contains(el) ? 'is inside' : 'holds'} ${nested.entry.id}, which is moved too`;
            continue;
        }
        const box = _levelMapBox(el, vb);
        if (!box) {
            record.problem = 'it has nothing to measure';
            continue;
        }
        const id = el.getAttribute('id').trim();
        found.push({
            el,
            entry: {
                id,
                // What "animate:<name>" reports: the layer's name before
                // Illustrator numbered it.
                name: (el.getAttribute('data-name') || id.replace(/-\d+$/, '')).trim(),
                paths: [path], box, world: _levelMapWorld(box, vb, worldWidth, worldHeight), reach,
            },
        });
    }
    if (!found.length) return;

    // Paint order, then slabs: layers whose sweeps overlap, directly or
    // through another layer, are drawn as one.
    found.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const groups = [];
    for (const item of found) {
        let group = { region: _levelMapSweep(item.entry), members: [item] };
        for (let merged = true; merged;) {
            merged = false;
            for (let i = groups.length - 1; i >= 0; i--) {
                if (!_levelMapOverlaps(groups[i].region, group.region)) continue;
                group = { region: _levelMapUnion(groups[i].region, group.region),
                          members: [...groups[i].members, ...group.members] };
                groups.splice(i, 1);
                merged = true;
            }
        }
        groups.push(group);
    }

    const borders = Array.from(root.querySelectorAll('*')).filter(_svgSceneIsBorderEl);
    for (const group of groups) {
        group.members.sort((a, b) => found.indexOf(a) - found.indexOf(b));
        const layerEls = group.members.map(item => item.el);
        const region = _levelMapSnapBox(group.region, vb, worldWidth, worldHeight);
        const others = found.filter(item => !layerEls.includes(item.el)).map(item => item.el);
        const { slices, sprites } = _levelMapSlab(root, vb, layerEls, region, new Set([...live, ...borders, ...others]));
        map.slabs.push({
            box: region,
            world: _levelMapWorld(region, vb, worldWidth, worldHeight),
            layers: group.members.map(item => item.entry.id),
            slices, sprites,
        });
    }
    for (const item of found) {
        map.layers.push(item.entry);
        map.stripIds.push(item.entry.id);
    }
}

// ── Parse ─────────────────────────────────────────────────────────────────────
// parseLevelMap - every map id in a level SVG, measured and placed in the
// world. Boxes are in viewBox units ({ x, y, width, height }, as elsewhere in
// svg-scenes.js); world boxes are in world pixels ({ x, y, w, h }, as entities
// have them). field is the scene's #field shape, used to check holes, and
// levelDir is the level's folder, where ANIMATE frames are looked for. layers
// are the layers a level design moves, as levelDesignLayerMoves lists them.
//
//   enterables  { id, name, box, world, restricted, requires: [{ id, type, name }] }
//   hotspots    { id, type, enterable, restricted, box, world, push }
//   events      { id, name, box, world }
//   reserved    { id, label, name, box, world }, recognised but not built
//   objects     { id, name, box, world, children: [ids] }
//   animations  { id, assetName, object, box, world, frameName, frames, frameViewBox,
//                 drawBox, drawWorld }
//   breakables  { id, name, object, box, world, spriteBox, spriteWorld, markup, colors,
//                 states: { damaged, broken } }
//   holes       { id, box, world, normalizedPoints }
//   layers      { id, name, paths, box, world, reach }, the layers a design moves
//   slabs       { box, world, layers: [ids], slices: [markup], sprites: [markup] }
//   layerRequests { path, problem, matches }, one per layer asked for
//   ids         every layer name in the art (data-name, else id), for suggestions
//   regions     every entry above in document order, as { id, kind, parent, world },
//               plus REQUIRE- layers, whose world is null when they are empty
//   stripIds    ids the background image leaves out because they are drawn live
//   warnings    what in the file will not work as its names suggest
function parseLevelMap(svgText, { worldWidth = 800, worldHeight = 600, levelDir = '', field = null,
                                  layers = [] } = {}) {
    const map = {
        vb: null, scale: { x: 0, y: 0 }, levelDir,
        enterables: [], hotspots: [], objects: [], animations: [], breakables: [], holes: [],
        events: [], reserved: [], layers: [], slabs: [], layerRequests: [], ids: [],
        regions: [], stripIds: [], warnings: [],
    };
    const warn = text => map.warnings.push(text);

    const mount = _levelMapMount(svgText);
    if (!mount) {
        warn('the level SVG could not be parsed, so it has no map');
        return map;
    }
    const { doc, root, vb } = mount;
    map.vb = vb;
    map.scale = { x: worldWidth / vb.width, y: worldHeight / vb.height };

    try {
        const defsMarkup = Array.from(doc.querySelectorAll('defs'))
            .map(defs => new XMLSerializer().serializeToString(defs))
            .join('');
        const named = new Map();   // "<kind>:<name>" -> first id, to catch two of one name

        for (const el of root.querySelectorAll('[id]')) {
            if (el.closest('defs')) continue;
            const id = el.getAttribute('id').trim();
            const rule = levelMapRule(id);
            if (!rule) {
                if (LEVEL_MAP_UNKNOWN_RE.test(id)) warn(`"${id}" looks like a map id but matches no rule`);
                continue;
            }

            // A requirement is a name, not a place, so it is read before the
            // check below that drops anything with nothing to measure: an
            // empty REQUIRE- layer is the usual way to write one.
            if (rule.kind === 'require') {
                _levelMapRequire(map, el, root, vb, id, rule, worldWidth, worldHeight, warn);
                continue;
            }

            const box = _levelMapBox(el, vb);
            if (!box) {
                warn(`${id} has nothing to measure, so it is ignored`);
                continue;
            }
            const world = _levelMapWorld(box, vb, worldWidth, worldHeight);
            const parent = _levelMapMappedAncestor(el, root)?.id || null;

            // Events are keyed by name, so two things of one kind sharing a
            // name could not be told apart. Hotspots repeat types by design.
            if (rule.kind === 'enterable' || rule.kind === 'object' || rule.kind === 'breakable') {
                const key = `${rule.kind}:${rule.name}`;
                if (named.has(key)) {
                    warn(`${named.get(key)} and ${id} are both ${rule.label} "${rule.name}"; `
                       + 'events cannot tell them apart');
                } else {
                    named.set(key, id);
                }
            }

            switch (rule.kind) {
                case 'enterable':
                    map.enterables.push({ id, name: rule.name, box, world,
                                          restricted: rule.restricted, requires: [] });
                    break;
                case 'event':
                    map.events.push({ id, name: rule.name, box, world });
                    break;
                case 'reserved':
                    warn(`${id}: ${rule.label}- is recognised, but not built yet`);
                    map.reserved.push({ id, label: rule.label, name: rule.name, box, world });
                    break;
                case 'hotspot': {
                    const type = (/^([a-z]+)/i.exec(rule.name)?.[1] || '').toLowerCase();
                    if (!LEVEL_MAP_ENTER_TYPES.includes(type)) {
                        warn(`${id}: ENTER type "${type}" is not one of ${LEVEL_MAP_ENTER_TYPES.join(', ')}`);
                    }
                    const enterable = _levelMapMappedAncestor(el, root, 'enterable');
                    map.hotspots.push({
                        id, type, box, world,
                        enterable: enterable?.name || null,
                        restricted: !!(enterable && levelMapRule(enterable.id)?.restricted),
                        push: 'up',
                    });
                    break;
                }
                case 'object':
                    map.objects.push({ id, name: rule.name, box, world, children: [] });
                    break;
                case 'animate': {
                    const frames = _levelMapFrames(rule.name, levelDir);
                    const entry = {
                        id, assetName: rule.name, box, world,
                        object: _levelMapMappedAncestor(el, root, 'object')?.name || null,
                        frameName: frames.name, frames: frames.paths,
                        frameViewBox: null, drawBox: null, drawWorld: null,
                    };
                    if (!frames.paths.length) {
                        // Left in the background, so a missing file costs the
                        // animation but never the art.
                        warn(`${id}: no frames named "${rule.name}_0.svg" or "${rule.name}.svg" in `
                           + `${levelDir}objects/ or assets/objects/, so it stays static`);
                    } else {
                        if (frames.paths.length === 1) {
                            warn(`${id} found one frame (${frames.paths[0]}), so there is nothing to animate`);
                        }
                        // Every frame is drawn the way frame 0 measures: one
                        // animation is one artboard exported several times.
                        const place = _levelMapFramePlacement(_svgTextCache.get(frames.paths[0]), box);
                        entry.frameViewBox = place.viewBox;
                        entry.drawBox = place.drawBox;
                        entry.drawWorld = _levelMapWorld(entry.drawBox, vb, worldWidth, worldHeight);
                        map.stripIds.push(id);
                    }
                    map.animations.push(entry);
                    break;
                }
                case 'breakable': {
                    const spriteBox = _levelMapPad(box, LEVEL_MAP_SPRITE_PAD);
                    map.breakables.push({
                        id, name: rule.name, box, world,
                        object: _levelMapMappedAncestor(el, root, 'object')?.name || null,
                        spriteBox,
                        spriteWorld: _levelMapWorld(spriteBox, vb, worldWidth, worldHeight),
                        markup: _levelMapSpriteMarkup(el, spriteBox, defsMarkup,
                                                      _levelMapParentMatrix(el, root, vb)),
                        colors: _levelMapColors(el),
                        // Art for the hit and broken states, if the level has
                        // it, like the crate's three sprites. Without it the
                        // piece shakes as itself and is simply gone once broken.
                        states: {
                            damaged: _levelMapStateSprite(levelDir, rule.name, 'damaged'),
                            broken:  _levelMapStateSprite(levelDir, rule.name, 'broken'),
                        },
                    });
                    // Drawn live from its own sprite, so it can shake and break.
                    map.stripIds.push(id);
                    break;
                }
                case 'hole': {
                    const normalizedPoints = _levelMapHolePoints(el, box, vb, warn);
                    const outside = field?.normalizedPoints
                        && normalizedPoints.some(p => !_pointInPolygon(p.x, p.y, field.normalizedPoints));
                    if (outside) {
                        warn(`${id} reaches outside #field; a hole has to sit inside the walkable `
                           + 'area for movement around it to work');
                    }
                    map.holes.push({ id, box, world, normalizedPoints });
                    break;
                }
            }
            map.regions.push({ id, kind: rule.label, parent, world });
        }
        map.ids = [...new Set(Array.from(root.querySelectorAll('[id]'))
            .filter(el => !el.closest('defs'))
            .map(el => _levelMapNames(el).pop()))];
        // After the map's own live pieces, which a moving layer must not be.
        if (layers.length) _levelMapMovingLayers(map, root, vb, layers, worldWidth, worldHeight);
    } finally {
        mount.unmount();
    }

    for (const object of map.objects) {
        object.children = [...map.animations, ...map.breakables]
            .filter(entry => entry.object === object.name)
            .map(entry => entry.id);
    }
    for (const enterable of map.enterables) {
        if (!map.hotspots.some(hotspot => hotspot.enterable === enterable.name)) {
            warn(`${enterable.id} has no ENTER- hotspot inside it, so it cannot be entered`);
        }
        // Not an error: the level design can name the condition under
        // "restricted". Said here because without one it never opens.
        if (enterable.restricted && !enterable.requires.length) {
            warn(`${enterable.id} has no REQUIRE- layer; it stays locked unless the level design `
               + `names a condition under "restricted": { "${enterable.name}": { "until": ... } }`);
        }
    }
    return map;
}

// _levelMapRequire - read one REQUIRE-<type>-<name> layer onto the RESTRICTED
// it sits in. A requirement anywhere else, or of a type nothing reads, is
// reported: either way the lock it was meant for would never open.
function _levelMapRequire(map, el, root, vb, id, rule, worldWidth, worldHeight, warn) {
    const parsed = LEVEL_MAP_REQUIRE_RE.exec(rule.name);
    const type = parsed?.[1] || '';
    const name = (parsed?.[2] || '').replace(/-\d+$/, '');
    const box = _levelMapBox(el, vb);
    const world = box ? _levelMapWorld(box, vb, worldWidth, worldHeight) : null;
    const owner = _levelMapMappedAncestor(el, root, 'enterable');
    const enterable = owner && map.enterables.find(entry => entry.id === owner.id);

    map.regions.push({ id, kind: rule.label, parent: _levelMapMappedAncestor(el, root)?.id || null, world });
    if (!LEVEL_MAP_REQUIRE_TYPES.includes(type) || !name) {
        warn(`${id}: write it as REQUIRE-<type>-<name>, with <type> one of `
           + `${LEVEL_MAP_REQUIRE_TYPES.join(', ')}`);
        return;
    }
    if (!enterable || !enterable.restricted) {
        warn(`${id} is not inside a RESTRICTED- layer, so it has nothing to unlock`);
        return;
    }
    if (type === 'item') warn(`${id}: REQUIRE-item- is recognised, but not built yet`);
    enterable.requires.push({ id, type, name });
}

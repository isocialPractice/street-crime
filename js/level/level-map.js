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
//     ENTER-<type>          its entry hotspot; <type> picks what entering does
//   OBJECT-<name>           an area holding something to interact with
//     ANIMATE-<asset-name>  drawn from frames <asset-name>_0.svg, _1, ...
//     BREAKABLE-<name>      cut out of the art; takes hits and breaks
//   negative-space          a hole in #field that nobody can walk into
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
const LEVEL_MAP_RULES = [
    { kind: 'enterable', label: 'ENTERABLE',      re: /^ENTERABLE[-_](.+)$/ },
    { kind: 'hotspot',   label: 'ENTER',          re: /^ENTER[-_](.+)$/ },
    { kind: 'object',    label: 'OBJECT',         re: /^OBJECT[-_](.+)$/ },
    { kind: 'animate',   label: 'ANIMATE',        re: /^ANIMATE[-_](.+)$/ },
    { kind: 'breakable', label: 'BREAKABLE',      re: /^BREAKABLE[-_](.+)$/ },
    { kind: 'hole',      label: 'negative-space', re: /^negative-space(?:[-_]\d+)?$/ },
];

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
        if (match) return { kind: rule.kind, label: rule.label, name: match[1] || id };
    }
    return null;
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

// ── Parse ─────────────────────────────────────────────────────────────────────
// parseLevelMap - every map id in a level SVG, measured and placed in the
// world. Boxes are in viewBox units ({ x, y, width, height }, as elsewhere in
// svg-scenes.js); world boxes are in world pixels ({ x, y, w, h }, as entities
// have them). field is the scene's #field shape, used to check holes, and
// levelDir is the level's folder, where ANIMATE frames are looked for.
//
//   enterables  { id, name, box, world }
//   hotspots    { id, type, enterable, box, world, push }
//   objects     { id, name, box, world, children: [ids] }
//   animations  { id, assetName, object, box, world, frameName, frames, frameViewBox,
//                 drawBox, drawWorld }
//   breakables  { id, name, object, box, world, spriteBox, spriteWorld, markup, colors,
//                 states: { damaged, broken } }
//   holes       { id, box, world, normalizedPoints }
//   regions     every entry above in document order, as { id, kind, parent, world }
//   stripIds    ids the background image leaves out because they are drawn live
//   warnings    what in the file will not work as its names suggest
function parseLevelMap(svgText, { worldWidth = 800, worldHeight = 600, levelDir = '', field = null } = {}) {
    const map = {
        vb: null, scale: { x: 0, y: 0 }, levelDir,
        enterables: [], hotspots: [], objects: [], animations: [], breakables: [], holes: [],
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
                    map.enterables.push({ id, name: rule.name, box, world });
                    break;
                case 'hotspot': {
                    const type = (/^([a-z]+)/i.exec(rule.name)?.[1] || '').toLowerCase();
                    if (!LEVEL_MAP_ENTER_TYPES.includes(type)) {
                        warn(`${id}: ENTER type "${type}" is not one of ${LEVEL_MAP_ENTER_TYPES.join(', ')}`);
                    }
                    map.hotspots.push({
                        id, type, box, world,
                        enterable: _levelMapMappedAncestor(el, root, 'enterable')?.name || null,
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
    }
    return map;
}

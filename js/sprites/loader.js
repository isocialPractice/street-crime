// js/sprites/loader.js — SVG asset loading utilities
// Provides loadSvgFile and loadSvgImg used by all sprite modules, plus the
// authored-size measurements every renderer scales against (svgUnitPx and
// svgDrawSize). _decodePromises is populated as sprites load; ASSETS_READY (in
// ready.js) resolves once every sprite has been fetched and decoded.
//
// Batched loading
// ---------------
// loadSvgFile used to fetch over synchronous XHR, there and then, as each
// sprite module was evaluated. That put every sprite file in the game through
// the main thread one blocking round trip at a time, which came to roughly 20
// seconds of a startup the page could not repaint during: the loading screen
// sat frozen rather than merely waiting.
//
// It now hands back the Image straight away and notes the path down. Everything
// noted is fetched in one parallel pass once the document has been parsed, and
// each Image is given its contents as they arrive. The sprite modules keep
// their plain declarative shape and what they hand out is unchanged, since an
// Image is what they were getting before; it simply fills in a moment later,
// well before ASSETS_READY lets the game start.

const _decodePromises = [];

// Captures the width and height out of a viewBox, whatever separators it uses.
const SVG_VIEWBOX_RE = /viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/;

function _trackSvgDecode(img) {
    _decodePromises.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    return img;
}

// _recordAuthoredSize - stamp a sprite with the size the artist actually drew.
//
// The files carry a viewBox but no width or height, so the browser has an
// aspect ratio to work from but no intrinsic size, and falls back to the
// default sizing algorithm: the largest box of that ratio fitting 300x150. A
// tall standing pose is therefore pinned to 150px high while a wide lying pose
// stretches to 300px across, which makes naturalWidth a measure of a frame's
// shape rather than of what was drawn. Drawing at natural size makes a
// character balloon the moment an animation turns wide, which is what a
// collapse, a defeat pose or any new wide-framed asset does.
//
// Recording the authored numbers here, on the one call every sprite passes
// through, is what lets svgUnitPx and svgDrawSize scale frames against each
// other instead.
function _recordAuthoredSize(img, svgStr) {
    const box = SVG_VIEWBOX_RE.exec(svgStr);
    if (!box) return img;
    img.authoredW = parseFloat(box[1]);
    img.authoredH = parseFloat(box[2]);
    return img;
}

// svgUnitPx - screen pixels per authored SVG unit, measured from one reference
// frame. Scaling every frame of a character by this keeps the pose the game is
// tuned around at exactly the size it has today and draws the rest in
// proportion to it, so nothing grows or shrinks as the animation changes shape.
// Returns 0 when the reference has not decoded yet or carries no authored size,
// which tells callers to fall back to natural size and ask again later.
function svgUnitPx(refImg) {
    const natural  = Math.max(refImg?.naturalWidth || 0, refImg?.naturalHeight || 0);
    const authored = Math.max(refImg?.authoredW    || 0, refImg?.authoredH     || 0);
    if (!natural || !authored) return 0;
    return natural / authored;
}

// svgDrawSize - on-screen size for one frame at a given unit scale. Falls back
// to the raw natural size when the scale or the frame's authored size is
// missing, so a generated or unparsed SVG still draws.
function svgDrawSize(img, unitPx) {
    if (unitPx > 0 && img?.authoredW > 0 && img?.authoredH > 0) {
        return { w: img.authoredW * unitPx, h: img.authoredH * unitPx };
    }
    return { w: img?.naturalWidth || 0, h: img?.naturalHeight || 0 };
}

const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

// Text the batch has already pulled down, so a synchronous reader never pays
// for a file that is in hand.
const _svgTextCache = new Map();

// loadSvgText — reads one file synchronously. Still the right shape for callers
// that want the markup itself in the middle of doing something else, which is
// how the level scenes parse their backgrounds.
function loadSvgText(path) {
    if (_svgTextCache.has(path)) return _svgTextCache.get(path);
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.send();
        const text = xhr.responseText || EMPTY_SVG;
        _svgTextCache.set(path, text);
        return text;
    } catch (e) {
        console.warn('[assets] Could not load', path, e);
        return EMPTY_SVG;
    }
}

// Files the sprite modules register as they are evaluated, fetched together
// once the document has been parsed.
const _svgFileBatch = [];

// _registerSvgFile - hand back an Image now and fill it in with the batch.
//
// It measures 0 wide until then, which every renderer already reads as "not
// ready yet", and nothing draws before ASSETS_READY in any case.
function _registerSvgFile(path, optional) {
    const img = new Image();
    img.svgPath = path;
    _svgFileBatch.push({ path, img, optional });
    return img;
}

// _applySvgText - give a registered Image its contents. Through a Blob, because
// a direct img.src of an .svg path draws blank on a canvas in most browsers.
function _applySvgText(img, svgStr) {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(blob);
    _recordAuthoredSize(img, svgStr);
    _trackSvgDecode(img);
    return img;
}

// _settleSvgFile - apply what came back for one path to every Image waiting on
// it. A file that could not be read leaves a required sprite blank, exactly as
// the old synchronous path did, and marks an optional one missing so its module
// can drop it and use whatever fallback it has.
function _settleSvgFile(path, text, items) {
    if (text !== null) _svgTextCache.set(path, text);
    // A file nothing required is allowed to be absent, so only a required
    // waiter makes it worth saying anything about.
    else if (items.some(item => !item.optional)) console.warn('[assets] Could not load', path);
    for (const item of items) {
        if (text === null && item.optional) { item.img.missing = true; continue; }
        _applySvgText(item.img, text === null ? EMPTY_SVG : text);
    }
}

function _svgBatchByPath() {
    const byPath = new Map();
    for (const item of _svgFileBatch) {
        if (!byPath.has(item.path)) byPath.set(item.path, []);
        byPath.get(item.path).push(item);
    }
    return byPath;
}

// _readSvgFileSync - the original one-file-at-a-time read, still the fallback
// for anything fetch cannot answer. Opened straight off disk over file:// a
// fetch rejects outright while this may still succeed, and status 0 with a body
// is the only "found" signal there is on that protocol.
function _readSvgFileSync(path) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.send();
        const ok = (xhr.status >= 200 && xhr.status < 300)
                || (xhr.status === 0 && !!xhr.responseText);
        return ok ? xhr.responseText : null;
    } catch (e) {
        return null;
    }
}

// _flushSvgFileBatch - fetch every registered file at once, dropping back to a
// synchronous read for any one of them fetch could not deliver.
function _flushSvgFileBatch() {
    const batch = [..._svgBatchByPath().entries()];
    return Promise.all(batch.map(([path, items]) =>
        fetch(path)
            .then(res => (res.ok ? res.text() : null))
            .catch(() => null)
            .then(text => _settleSvgFile(path, text !== null ? text : _readSvgFileSync(path), items))
    )).then(() => { _svgFileBatch.length = 0; });
}

function _flushSvgFileBatchSync() {
    for (const [path, items] of _svgBatchByPath()) _settleSvgFile(path, _readSvgFileSync(path), items);
    _svgFileBatch.length = 0;
    return Promise.resolve();
}

// SVG_FILES_READY - settles once the batch has landed. DOMContentLoaded is the
// signal that every sprite module has had its turn to register, and it fires
// before game.js starts waiting on ASSETS_READY, which waits on this.
const SVG_FILES_READY = new Promise(resolve => {
    if (typeof document === 'undefined' || document.readyState !== 'loading') resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
}).then(() => (typeof fetch === 'function' ? _flushSvgFileBatch() : _flushSvgFileBatchSync()));

// loadSvgFile — the sprite a module asks for by path. The Image comes back now
// and its contents arrive with the batch.
function loadSvgFile(path) {
    return _registerSvgFile(path, false);
}

// loadOptionalSvgFile - a sprite that may legitimately not exist yet. The Image
// it returns carries img.missing once the batch has settled if nothing was
// there. Callers drop those and pick their fallback, so dropping the artwork in
// later is still all that is needed to switch over to it.
function loadOptionalSvgFile(path) {
    return _registerSvgFile(path, true);
}

// dropMissingSvgFiles - null out every key of a sprite map whose optional file
// turned out to be absent, so a plain truthiness test still answers correctly.
function dropMissingSvgFiles(spriteMap) {
    for (const [key, img] of Object.entries(spriteMap)) {
        if (img && img.missing) spriteMap[key] = null;
    }
    return spriteMap;
}

// loadSvgImg — loads an SVG string generated in JavaScript (not a file on disk).
// A Blob wraps the SVG text so the browser treats it as an image file.
// URL.createObjectURL() returns a temporary local URL the Image can load from.
function loadSvgImg(svgStr) {
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(blob);
    _recordAuthoredSize(img, svgStr);
    return _trackSvgDecode(img);
}

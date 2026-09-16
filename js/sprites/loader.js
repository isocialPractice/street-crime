// js/sprites/loader.js — SVG asset loading utilities
// Provides loadSvgFile and loadSvgImg used by all sprite modules, plus the
// authored-size measurements every renderer scales against (svgUnitPx and
// svgDrawSize). _decodePromises is populated as sprites load; ASSETS_READY (in
// ready.js) resolves once every sprite has finished decoding.

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

function loadSvgText(path) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false); // synchronous — only runs once at startup
        xhr.send();
        return xhr.responseText || '<svg xmlns="http://www.w3.org/2000/svg"/>';
    } catch(e) {
        console.warn('[assets] Could not load', path, e);
        return '<svg xmlns="http://www.w3.org/2000/svg"/>';
    }
}

// loadSvgFile — fetches an SVG file synchronously (XHR), converts it to a Blob
// URL and registers the resulting image for decode tracking. This is the only
// reliable way to draw SVG files on a canvas: direct img.src paths produce blank
// draws on most browsers.
function loadSvgFile(path) {
    return loadSvgImg(loadSvgText(path));
}

// loadOptionalSvgFile - loads a sprite that may legitimately not exist yet,
// returning null instead of a blank image when it is absent. Callers use the
// null to pick a procedural fallback, so dropping the artwork in later is all
// that is needed to switch over to it.
function loadOptionalSvgFile(path) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);
        xhr.send();
        const ok = (xhr.status >= 200 && xhr.status < 300)
                || (xhr.status === 0 && !!xhr.responseText);
        return ok ? loadSvgImg(xhr.responseText) : null;
    } catch (e) {
        return null;
    }
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

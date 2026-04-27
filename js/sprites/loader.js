// js/sprites/loader.js — SVG asset loading utilities
// Provides loadSvgFile and loadSvgImg used by all sprite modules.
// _decodePromises is populated as sprites load; ASSETS_READY (in ready.js)
// resolves once every sprite has finished decoding.

const _decodePromises = [];

function _trackSvgDecode(img) {
    _decodePromises.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    return img;
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

// loadSvgImg — loads an SVG string generated in JavaScript (not a file on disk).
// A Blob wraps the SVG text so the browser treats it as an image file.
// URL.createObjectURL() returns a temporary local URL the Image can load from.
function loadSvgImg(svgStr) {
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    img.src = URL.createObjectURL(blob);
    return _trackSvgDecode(img);
}

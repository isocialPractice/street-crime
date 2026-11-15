// scripts/lib/gameContext.js - the game's own level code, loaded in node, so
// a level design can be checked without a browser by the same functions
// SANDBOX TEST runs: parseLevelMap reads the art, prepareLevelDesign converts
// a draft and validates, and the item catalog, palettes, enemies and stages
// are read from the same files.
//
// The files load into a vm context, in index.html's order, with:
//
//   - scripts/lib/svgDom.js for DOMParser and XMLSerializer, so the SVG
//     readers walk a real element tree;
//   - a synchronous XMLHttpRequest that reads files under the repository,
//     which is how the game reads its config and art at startup;
//   - inert stand-ins for the rest of the page (canvas, images, document),
//     which the code below never needs answers from.
//
// The level map is read by name only. The helpers that measure or draw (the
// mount, getBBox, cut-out sprites, hole outlines, the slices of moving
// layers) are replaced after loading with ones that find the same elements
// but give nominal boxes, so every layer, parent and warning about names is
// the browser's, and nothing about where things are is. That stays SANDBOX
// TEST's to check.

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const dom  = require('./svgDom');

// The scripts the level checks need, in the order index.html loads them.
// Each must still be in index.html: a file renamed or removed there fails
// here, rather than this list quietly checking against old code.
const GAME_FILES = [
    'js/sprites/loader.js',
    'js/sprites/enemies.js',
    'js/sprites/variants.js',
    'js/level/svg-scenes.js',
    'js/level/level-map.js',
    'js/core/canvas.js',
    'js/core/config.js',
    'js/entities/entity.js',
    'js/entities/inventory.js',
    'js/entities/items.js',
    'js/entities/enemy.js',
    'js/level/data.js',
    'js/level/level-runtime.js',
    'js/level/level-design.js',
];

// Loaded after the game files: the same names, so the game's own callers
// use these instead.
const MEASURING_STAND_INS = `
// The level SVG parsed but not mounted: there is no page to lay it out in.
function _levelMapMount(svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const source = doc.documentElement;
    if (!source || source.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    return { doc, root: source, vb: _svgSceneViewBox(source), unmount() {} };
}

// Something to measure where the browser would find some: an element that is
// a shape, or holds one outside <defs>. Null for an empty group, as there.
const _NODE_CHECK_SHAPES = /^(path|rect|circle|ellipse|polygon|polyline|line|text|image|use)$/i;
function _levelMapBox(el, vb) {
    const drawn = _NODE_CHECK_SHAPES.test(el.localName)
        || el.querySelectorAll('*').some(node => _NODE_CHECK_SHAPES.test(node.localName) && !node.closest('defs'));
    return drawn ? { x: vb.x, y: vb.y, width: 1, height: 1 } : null;
}

// Paint, as the art writes it: a fill or stroke attribute, an inline style,
// or a class (Illustrator's exports fill shapes through .cls-N rules).
function _levelMapHasPaint(el) {
    const nodes = el.children.length ? el.querySelectorAll('*') : [el];
    return nodes.some(node => {
        if (node.children.length || node.closest('defs') || !_NODE_CHECK_SHAPES.test(node.localName)) return false;
        const fill = node.getAttribute('fill');
        const stroke = node.getAttribute('stroke');
        const style = node.getAttribute('style') || '';
        return (fill !== null && fill !== 'none') || (stroke !== null && stroke !== 'none')
            || /(?:^|;)\\s*(fill|stroke)\\s*:\\s*(?!none)/.test(style) || !!node.getAttribute('class')
            || /^(image|use|text)$/i.test(node.localName);
    });
}

function _levelMapParentMatrix() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
function _levelMapSpriteMarkup() { return ''; }
function _levelMapColors() { return []; }
function _levelMapHolePoints() { return []; }
function _levelMapSlab() { return { slices: [], sprites: [] }; }
`;

// An object that answers anything with itself: the canvas, its context, the
// document and the like, for code that sets them up at load and is never
// asked a question here.
function inert() {
    return new Proxy(function inertThing() {}, {
        get: (target, key) => (key === Symbol.toPrimitive ? () => 0
            : key === 'then' ? undefined
                : key === Symbol.iterator ? function* none() {}
                    : inert()),
        apply: () => inert(),
        construct: () => inert(),
        set: () => true,
        has: () => false,
    });
}

// createGameContext - a context with the game's level code loaded. root is
// the repository. files maps repository paths to text that is served in
// place of a file there, or where there is none: a level made up for a
// check, which never touches disk. Returns { ctx, notes, call, run }: notes
// holds what the game's code wrote to the console, as { level, text };
// call(name, ...args) runs a function defined in the context with plain
// values from here.
function createGameContext({ root = process.cwd(), files = {} } = {}) {
    const notes = [];
    const say = level => (...args) => {
        const [first, ...rest] = args;
        let text = String(first ?? '');
        // The game's messages use %s placeholders, as the console does.
        if (/%[sdo]/.test(text)) {
            text = text.replace(/%[sdo]/g, () => (rest.length ? String(rest.shift()) : ''));
        }
        notes.push({ level, text: [text, ...rest.map(String)].filter(Boolean).join(' ') });
    };

    // Synchronous reads of repository files, as the game's startup does over
    // http: 200 with the text, or 404.
    class XMLHttpRequest {
        open(method, url) { this.url = String(url); }
        setRequestHeader() {}
        overrideMimeType() {}
        send() {
            const rel = decodeURIComponent(this.url.split(/[?#]/)[0]).replace(/^\/+/, '');
            if (Object.prototype.hasOwnProperty.call(files, rel)) {
                this.responseText = String(files[rel]);
                this.status = 200;
                return;
            }
            const file = path.resolve(root, rel);
            const inside = file === root || file.startsWith(root + path.sep);
            try {
                if (!inside) throw new Error('outside the repository');
                this.responseText = fs.readFileSync(file, 'utf8');
                this.status = 200;
            } catch (e) {
                this.responseText = '';
                this.status = 404;
            }
        }
    }

    // Images that never load: nothing here draws, and a decode that never
    // settles keeps the game's image warm-up from claiming success.
    class Image {
        constructor() { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; }
        decode() { return new Promise(() => {}); }
        addEventListener() {}
    }

    class CustomEvent extends Event {
        constructor(type, options = {}) {
            super(type, options);
            this.detail = options.detail ?? null;
        }
    }

    const sandbox = {
        console: { log: say('log'), info: say('info'), warn: say('warn'), error: say('error'), table() {}, group() {}, groupEnd() {}, debug() {} },
        setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, structuredClone,
        performance, EventTarget, Event, CustomEvent, URL, Blob, TextEncoder, TextDecoder, Promise,
        XMLHttpRequest, Image,
        DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node,
        document: inert(),
        navigator: { userAgent: 'node' },
        location: { protocol: 'http:', href: 'http://localhost/', origin: 'http://localhost' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        requestAnimationFrame: () => 0,
        cancelAnimationFrame() {},
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        getComputedStyle: () => ({}),
        fetch: () => new Promise(() => {}),
        addEventListener() {},
        removeEventListener() {},
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);

    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const file of GAME_FILES) {
        if (!index.includes(`src="${file}"`)) {
            throw new Error(`${file} is not in index.html any more; update GAME_FILES in scripts/lib/gameContext.js`);
        }
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
    }
    // The enemy art warm-up starts as enemies.js loads and waits on image
    // decodes that never come; nothing here waits on it.
    vm.runInContext('if (typeof ENEMY_CHARS_READY !== "undefined") ENEMY_CHARS_READY.catch(() => {});', ctx);
    vm.runInContext(MEASURING_STAND_INS, ctx, { filename: 'scripts/lib/gameContext.js (stand-ins)' });
    // What the game wrote while loading is its own business, not the check's.
    notes.length = 0;

    const call = (name, ...args) => {
        ctx.__args = args;
        try {
            return vm.runInContext(`${name}(...__args)`, ctx);
        } finally {
            delete ctx.__args;
        }
    };
    return { ctx, notes, call, run: code => vm.runInContext(code, ctx) };
}

module.exports = { createGameContext, GAME_FILES };

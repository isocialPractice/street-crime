// js/sprites/variants.js - characters drawn with some of their parts recolored
//
// A render names parts of a character's art by layer name, and a palette for
// each: { "left-vest": "gray", "right-vest": "gray" }. Each frame's SVG text is
// changed before it becomes an image, so the files on disk are never touched:
// every shape in a named part takes the palette's color for that shape's tone.
//
//   part     an element whose id or data-name is the part's name, or a
//            numbered copy of it ("left-vest-2"). A frame that has no such part
//            but has the bare part ("vest" for "left-vest", "glove" for
//            "front-glove") uses that, since one pose may draw both sides of
//            something as a single group.
//   tone     the nearest layer at or above a shape, inside the part, named
//            "<tone>" or "<anything>-<tone>", by its name before Illustrator
//            numbered it: "vest-mid-4" (data-name "vest-mid") is "mid". A shape
//            with no tone name takes the tone whose color is nearest its own in
//            lightness, so an unnamed shape still changes with the rest.
//   skipped  shapes inside an outline group ("strokes", "outline",
//            "<anything>-outline"), and shapes with no fill, so outlines stay as
//            drawn and a stroke-only line is not filled in.
//
// Exported fills come from .cls-N rules in the file's <style>, and one rule can
// fill shapes in several parts, so the new color is set on each shape
// (style="fill:..."), which wins over any rule, instead of editing the rule.
//
// The palettes are config/palettes.json (config/schema/palettes.schema.json):
// tone names, lightest first, and named ramps with a color per tone.

const VARIANT_PALETTES_PATH = 'config/palettes.json';
const VARIANT_SHAPES     = new Set(['path', 'rect', 'polygon', 'polyline', 'circle', 'ellipse']);
const VARIANT_OUTLINE_RE = /^(?:strokes|outline|.+-outline)$/i;
const VARIANT_SIDE_RE    = /^(?:left|right|front|back)[-_](.+)$/i;
const VARIANT_HEX_RE     = /^#[0-9a-f]{6}$/i;
const VARIANT_FILL_RE    = /(?:^|;)\s*fill\s*:\s*([^;]+)/i;

// _loadVariantPalettes - config/palettes.json as { tones, palettes }, with
// anything in it that cannot be used said once in the console and left out.
// Read synchronously at startup, as config/enemy-assets.json is. A missing or
// broken file leaves no palettes, so every render warns rather than throws.
function _loadVariantPalettes() {
    const out = { tones: [], palettes: {} };
    let parsed;
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', VARIANT_PALETTES_PATH, false);
        xhr.send();
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    } catch (e) {
        console.warn('[variants] Could not load %s', VARIANT_PALETTES_PATH, e);
        return out;
    }
    const warn = text => console.warn('[variants] %s: %s', VARIANT_PALETTES_PATH, text);
    if (!parsed || typeof parsed !== 'object') {
        warn('not a JSON object, so there are no palettes');
        return out;
    }
    out.tones = Array.isArray(parsed.tones)
        ? parsed.tones.filter(tone => typeof tone === 'string' && tone.trim()).map(tone => tone.trim().toLowerCase())
        : [];
    if (!out.tones.length) warn('"tones" lists no tones, so no shape has a tone');
    for (const [name, ramp] of Object.entries(parsed.palettes || {})) {
        if (!ramp || typeof ramp !== 'object') {
            warn(`palette "${name}" should be an object of tone colors`);
            continue;
        }
        const colors = {};
        for (const [tone, color] of Object.entries(ramp)) {
            if (!out.tones.includes(tone)) warn(`palette "${name}" names tone "${tone}", which is not in "tones"`);
            else if (typeof color !== 'string' || !VARIANT_HEX_RE.test(color)) warn(`palette "${name}" "${tone}" should be #rrggbb`);
            else colors[tone] = color.toLowerCase();
        }
        const missing = out.tones.filter(tone => !(tone in colors));
        if (!Object.keys(colors).length) {
            warn(`palette "${name}" has no colors`);
            continue;
        }
        if (missing.length) warn(`palette "${name}" has no ${missing.join(', ')}; the nearest tone's color is used`);
        out.palettes[name] = colors;
    }
    return out;
}

const VARIANT_PALETTES = _loadVariantPalettes();

// ── Colors ────────────────────────────────────────────────────────────────────
// _variantRgb - a CSS color as [r, g, b], for the forms exports use (#rgb,
// #rrggbb, rgb()), and black and white; null for anything else, such as a
// gradient's url(#...).
function _variantRgb(color) {
    const text = String(color || '').trim().toLowerCase();
    if (text === 'black') return [0, 0, 0];
    if (text === 'white') return [255, 255, 255];
    let m = /^#([0-9a-f]{3})$/.exec(text);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16));
    m = /^#([0-9a-f]{6})$/.exec(text);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
    return m ? [m[1], m[2], m[3]].map(Number) : null;
}

// _variantLightness - CIE L*, 0 to 100: how light a color looks, so "nearest"
// means what it looks like rather than how much light it gives off.
function _variantLightness([r, g, b]) {
    const lin = c => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : y * (24389 / 27);
}

// variantRampColor - a palette's color for a tone, or for the nearest tone in
// the list that it has a color for.
function variantRampColor(ramp, tone, tones = VARIANT_PALETTES.tones) {
    if (ramp[tone]) return ramp[tone];
    const at = tones.indexOf(tone);
    const by = tones.filter(t => ramp[t]).sort((a, b) => Math.abs(tones.indexOf(a) - at) - Math.abs(tones.indexOf(b) - at));
    return ramp[by[0]] || Object.values(ramp)[0];
}

// _variantNearestTone - the tone whose ramp color is nearest a fill in
// lightness; the middle tone for a fill with no single color.
function _variantNearestTone(fill, ramp, tones) {
    const rgb = _variantRgb(fill);
    if (!rgb) return tones[Math.floor(tones.length / 2)];
    const l = _variantLightness(rgb);
    let best = tones[0];
    let bestDistance = Infinity;
    for (const tone of tones) {
        const color = _variantRgb(variantRampColor(ramp, tone, tones));
        const distance = color ? Math.abs(_variantLightness(color) - l) : Infinity;
        if (distance < bestDistance) {
            best = tone;
            bestDistance = distance;
        }
    }
    return best;
}

// ── Reading the art ───────────────────────────────────────────────────────────
// _variantClassFills - class name -> { fill, order } from the file's <style>
// rules, order being the rule's place in the sheet, since of two classes on
// one shape the later rule wins. Grouped selectors (".cls-9, .cls-10") count
// for each class.
function _variantClassFills(doc) {
    const fills = new Map();
    let order = 0;
    for (const style of doc.querySelectorAll('style')) {
        const css = style.textContent.replace(/\/\*[\s\S]*?\*\//g, '');
        for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
            order++;
            const fill = VARIANT_FILL_RE.exec(body)?.[1]?.trim();
            if (!fill) continue;
            for (const selector of selectors.split(',')) {
                const m = /^\s*\.([\w-]+)\s*$/.exec(selector);
                if (m) fills.set(m[1], { fill, order });
            }
        }
    }
    return fills;
}

// _variantOwnFill - the fill set on the element itself, by the cascade: its
// style attribute, then the latest class rule, then a fill attribute (an
// attribute loses to any rule). Null when it only inherits.
function _variantOwnFill(el, classFills) {
    const inline = VARIANT_FILL_RE.exec(el.getAttribute('style') || '')?.[1]?.trim();
    if (inline && inline !== 'inherit') return inline;
    let best = null;
    for (const name of (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)) {
        const rule = classFills.get(name);
        if (rule && (!best || rule.order > best.order)) best = rule;
    }
    if (best && best.fill !== 'inherit') return best.fill;
    const attr = (el.getAttribute('fill') || '').trim();
    return attr && attr !== 'inherit' ? attr : null;
}

// _variantFill - the fill a shape is drawn with: its own, or the nearest
// ancestor's, or black, SVG's starting fill.
function _variantFill(el, classFills) {
    for (let node = el; node && node.nodeType === 1; node = node.parentNode) {
        const fill = _variantOwnFill(node, classFills);
        if (fill) return fill;
    }
    return 'black';
}

// _variantBaseName - a layer's name before Illustrator numbered a copy of it:
// its data-name, else its id without a trailing "-<n>".
function _variantBaseName(el) {
    const dataName = (el.getAttribute('data-name') || '').trim();
    if (dataName) return dataName;
    return (el.getAttribute('id') || '').trim().replace(/-\d+$/, '');
}

// _variantPartElements - the elements a part name names, outermost only (a
// match inside another match is already covered by it).
function _variantPartElements(root, part) {
    const wanted = String(part).trim().toLowerCase();
    const found = Array.from(root.querySelectorAll('[id]')).filter(el =>
        !el.closest('defs')
        && (_variantBaseName(el).toLowerCase() === wanted || el.getAttribute('id').trim().toLowerCase() === wanted));
    return found.filter(el => !found.some(other => other !== el && other.contains(el)));
}

// _variantFindPart - a part's elements in one frame, falling back to the bare
// part when the frame has no sided one, as { els, used }; used is the name that
// matched, or null when nothing did.
function _variantFindPart(root, part) {
    const els = _variantPartElements(root, part);
    if (els.length) return { els, used: part };
    const bare = VARIANT_SIDE_RE.exec(part)?.[1];
    const fallback = bare ? _variantPartElements(root, bare) : [];
    return fallback.length ? { els: fallback, used: bare } : { els: [], used: null };
}

function _variantShapes(partEl) {
    if (VARIANT_SHAPES.has(partEl.localName)) return [partEl];
    return Array.from(partEl.querySelectorAll('*')).filter(el => VARIANT_SHAPES.has(el.localName));
}

function _variantInOutline(shape, partEl) {
    for (let node = shape; node && node !== partEl; node = node.parentNode) {
        if (VARIANT_OUTLINE_RE.test(_variantBaseName(node))) return true;
    }
    return false;
}

// _variantTone - the tone a shape's own name or a layer it sits in gives it,
// looking no higher than the part; null when none does.
function _variantTone(shape, partEl, tones) {
    for (let node = shape; node && node.nodeType === 1; node = node.parentNode) {
        const name = _variantBaseName(node).toLowerCase();
        const tone = tones.find(t => name === t || name.endsWith(`-${t}`));
        if (tone) return tone;
        if (node === partEl) break;
    }
    return null;
}

function _variantSetFill(el, color) {
    const rest = (el.getAttribute('style') || '')
        .split(';')
        .map(rule => rule.trim())
        .filter(rule => rule && !/^fill\s*:/i.test(rule));
    el.setAttribute('style', [...rest, `fill:${color}`].join(';'));
}

// ── Rendering ─────────────────────────────────────────────────────────────────
// variantRenderKey - a render as one stable string, parts sorted:
// "left-vest=gray,right-vest=gray". One render is always one key.
function variantRenderKey(render) {
    return Object.keys(render || {})
        .sort()
        .map(part => `${part}=${typeof render[part] === 'string' ? render[part] : JSON.stringify(render[part])}`)
        .join(',');
}

// renderSvgVariant - one frame's SVG text with a render applied, and what
// happened, as { text, recolored, missing, fallbacks, problems }: how many
// shapes changed, the parts the frame does not have, the parts found only by
// their bare name ({ part, used }), and anything else in the way, in words.
// Never throws: text that will not parse comes back as it was.
function renderSvgVariant(svgText, render, palettes = VARIANT_PALETTES) {
    const result = { text: svgText, recolored: 0, missing: [], fallbacks: [], problems: [] };
    const doc = new DOMParser().parseFromString(String(svgText ?? ''), 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || doc.querySelector('parsererror')) {
        result.problems.push('the SVG could not be read, so it is drawn as it is');
        return result;
    }
    const classFills = _variantClassFills(doc);
    const done = new Set();   // part elements already recolored: both sides can fall back to one
    for (const [part, value] of Object.entries(render || {})) {
        if (typeof value !== 'string') {
            result.problems.push(`"${part}" is ${JSON.stringify(value)}; only a palette name is built`);
            continue;
        }
        const ramp = palettes.palettes[value];
        if (!ramp) {
            result.problems.push(`"${part}" names palette "${value}", which is not in ${VARIANT_PALETTES_PATH}`);
            continue;
        }
        const { els, used } = _variantFindPart(root, part);
        if (!used) {
            result.missing.push(part);
            continue;
        }
        if (used !== part) result.fallbacks.push({ part, used });
        for (const partEl of els) {
            if (done.has(partEl)) continue;
            done.add(partEl);
            for (const shape of _variantShapes(partEl)) {
                if (_variantInOutline(shape, partEl)) continue;
                const fill = _variantFill(shape, classFills);
                if (/^(?:none|transparent)$/i.test(fill)) continue;
                const tone = _variantTone(shape, partEl, palettes.tones)
                          || _variantNearestTone(fill, ramp, palettes.tones);
                _variantSetFill(shape, variantRampColor(ramp, tone, palettes.tones));
                result.recolored++;
            }
        }
    }
    result.text = new XMLSerializer().serializeToString(doc);
    return result;
}

// variantArtParts - what one frame offers a render, cached by file: names, its
// layer names (before Illustrator's numbering), and find(part), the name the
// part is found under (itself, or its bare name, as a render would find it),
// or null. What a level design's checks read to say a part is not there.
const _variantArt = new Map();

function variantArtParts(path, svgText) {
    if (!_variantArt.has(path)) {
        const doc = new DOMParser().parseFromString(String(svgText ?? ''), 'image/svg+xml');
        const root = doc.documentElement;
        const ok = !!root && !doc.querySelector('parsererror');
        const names = ok
            ? [...new Set(Array.from(root.querySelectorAll('[id]')).filter(el => !el.closest('defs')).map(_variantBaseName))]
            : [];
        _variantArt.set(path, { names, find: part => (ok ? _variantFindPart(root, part).used : null) });
    }
    return _variantArt.get(path);
}

// Frames already rendered, by file and render key, and the warnings already
// given, so a frame shared by several animations is rendered and reported once.
const _variantFrames = new Map();
const _variantWarned = new Set();

// variantFrameText - a frame file's text with a render applied, rendered the
// first time it is asked for. What the frame cannot do (a part it does not
// have, a palette that does not exist) is said once per file in the console.
function variantFrameText(path, svgText, render) {
    const key = `${path}|${variantRenderKey(render)}`;
    if (!_variantFrames.has(key)) {
        const result = renderSvgVariant(svgText, render);
        const file = String(path).split('/').pop();
        const say = text => {
            if (_variantWarned.has(`${file}|${text}`)) return;
            _variantWarned.add(`${file}|${text}`);
            console.warn('[variants] %s: %s', file, text);
        };
        result.missing.forEach(part => say(`has no ${part}, so it stays as drawn`));
        result.problems.forEach(say);
        _variantFrames.set(key, result);
    }
    return _variantFrames.get(key).text;
}

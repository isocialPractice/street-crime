// scripts/lib/svgDom.js - just enough of the browser's DOM, in node, for the
// game's own SVG readers to run unchanged: DOMParser, XMLSerializer and an
// element tree with the calls js/level/level-map.js and js/sprites/variants.js
// make (getAttribute, children, parentElement, querySelectorAll, closest,
// contains, compareDocumentPosition, textContent).
//
// It reads names and nesting, and measures nothing: there is no getBBox or
// getCTM here. scripts/lib/gameContext.js stands in for the few helpers that
// measure, so the level map a node check builds has every layer and parent the
// browser's has, with nominal boxes.
//
// Selectors are simple and compound only, the kind the game uses: a tag or *,
// then any of [attr], [attr="value"], #id and .class, and comma lists of
// those. A combinator (a space, >, + or ~) throws, so a selector this does not
// understand is never answered wrongly.

'use strict';

const ELEMENT_NODE  = 1;
const TEXT_NODE     = 3;
const DOCUMENT_NODE = 9;
const POSITION = { DISCONNECTED: 1, PRECEDING: 2, FOLLOWING: 4, CONTAINS: 8, CONTAINED_BY: 16 };

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
        if (name[0] === '#') {
            const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
        }
        return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : whole;
    });
}

function escapeText(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(text) {
    return escapeText(text).replace(/"/g, '&quot;');
}

// ── Selectors ─────────────────────────────────────────────────────────────────
const _selectorCache = new Map();

function compileSelector(selector) {
    if (_selectorCache.has(selector)) return _selectorCache.get(selector);
    const alternatives = String(selector).split(',').map(part => part.trim()).filter(Boolean).map(part => {
        if (/[\s>+~]/.test(part.replace(/\[[^\]]*\]/g, ''))) {
            throw new Error(`svgDom: selector "${selector}" has a combinator, which this DOM does not support`);
        }
        const tests = [];
        let rest = part;
        const tag = /^([A-Za-z][\w:-]*|\*)/.exec(rest);
        if (tag) {
            if (tag[1] !== '*') {
                const name = tag[1].toLowerCase();
                tests.push(el => el.localName.toLowerCase() === name || el.nodeName.toLowerCase() === name);
            }
            rest = rest.slice(tag[0].length);
        }
        while (rest.length) {
            let m;
            if ((m = /^\[\s*([\w:-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?\]/.exec(rest))) {
                const name = m[1];
                const value = m[2] ?? m[3] ?? m[4];
                tests.push(value === undefined ? el => el.hasAttribute(name) : el => el.getAttribute(name) === value);
            } else if ((m = /^#([\w-]+)/.exec(rest))) {
                const id = m[1];
                tests.push(el => el.getAttribute('id') === id);
            } else if ((m = /^\.([\w-]+)/.exec(rest))) {
                const name = m[1];
                tests.push(el => (el.getAttribute('class') || '').split(/\s+/).includes(name));
            } else {
                throw new Error(`svgDom: cannot read selector "${selector}" at "${rest}"`);
            }
            rest = rest.slice(m[0].length);
        }
        return el => tests.every(test => test(el));
    });
    const matches = el => alternatives.some(test => test(el));
    _selectorCache.set(selector, matches);
    return matches;
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
class SvgNode {
    constructor(type, doc) {
        this.nodeType = type;
        this.ownerDocument = doc;
        this.parentNode = null;
        this.childNodes = [];
    }

    get parentElement() {
        return this.parentNode && this.parentNode.nodeType === ELEMENT_NODE ? this.parentNode : null;
    }

    get children() {
        return this.childNodes.filter(node => node.nodeType === ELEMENT_NODE);
    }

    get firstElementChild() {
        return this.children[0] || null;
    }

    get textContent() {
        if (this.nodeType === TEXT_NODE) return this.data;
        return this.childNodes.map(node => node.textContent).join('');
    }

    set textContent(value) {
        for (const child of this.childNodes) child.parentNode = null;
        this.childNodes = [];
        if (value !== '' && value !== null && value !== undefined) this.appendChild(new SvgText(String(value), this.ownerDocument));
    }

    appendChild(node) {
        if (node.parentNode) node.parentNode.removeChild(node);
        node.parentNode = this;
        this.childNodes.push(node);
        return node;
    }

    removeChild(node) {
        const i = this.childNodes.indexOf(node);
        if (i >= 0) this.childNodes.splice(i, 1);
        node.parentNode = null;
        return node;
    }

    remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
    }

    contains(other) {
        for (let node = other; node; node = node.parentNode) if (node === this) return true;
        return false;
    }

    // Every element below this one, in document order.
    _descendants(out = []) {
        for (const child of this.childNodes) {
            if (child.nodeType !== ELEMENT_NODE) continue;
            out.push(child);
            child._descendants(out);
        }
        return out;
    }

    querySelectorAll(selector) {
        const matches = compileSelector(selector);
        return this._descendants().filter(matches);
    }

    querySelector(selector) {
        const matches = compileSelector(selector);
        return this._descendants().find(matches) || null;
    }

    // Where other lies against this node, as the DOM's bit mask.
    compareDocumentPosition(other) {
        if (other === this) return 0;
        const chain = node => {
            const out = [];
            for (let n = node; n; n = n.parentNode) out.unshift(n);
            return out;
        };
        const a = chain(this);
        const b = chain(other);
        if (a[0] !== b[0]) return POSITION.DISCONNECTED;
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        if (i === a.length) return POSITION.CONTAINED_BY | POSITION.FOLLOWING;
        if (i === b.length) return POSITION.CONTAINS | POSITION.PRECEDING;
        const parent = a[i - 1];
        return parent.childNodes.indexOf(b[i]) > parent.childNodes.indexOf(a[i]) ? POSITION.FOLLOWING : POSITION.PRECEDING;
    }
}

class SvgText extends SvgNode {
    constructor(data, doc) {
        super(TEXT_NODE, doc);
        this.data = data;
        this.nodeName = '#text';
    }

    cloneNode() {
        return new SvgText(this.data, this.ownerDocument);
    }
}

class SvgElement extends SvgNode {
    constructor(name, doc) {
        super(ELEMENT_NODE, doc);
        this.nodeName = name;
        this.tagName = name;
        this.localName = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
        this._attributes = new Map();
        this.style = {};
    }

    get attributes() {
        return [...this._attributes].map(([name, value]) => ({ name, value }));
    }

    get id() {
        return this.getAttribute('id') || '';
    }

    getAttribute(name) {
        return this._attributes.has(name) ? this._attributes.get(name) : null;
    }

    hasAttribute(name) {
        return this._attributes.has(name);
    }

    setAttribute(name, value) {
        this._attributes.set(name, String(value));
    }

    removeAttribute(name) {
        this._attributes.delete(name);
    }

    closest(selector) {
        const matches = compileSelector(selector);
        for (let node = this; node && node.nodeType === ELEMENT_NODE; node = node.parentNode) {
            if (matches(node)) return node;
        }
        return null;
    }

    matches(selector) {
        return compileSelector(selector)(this);
    }

    cloneNode(deep = false) {
        const copy = new SvgElement(this.nodeName, this.ownerDocument);
        for (const [name, value] of this._attributes) copy._attributes.set(name, value);
        if (deep) for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
        return copy;
    }
}

class SvgDocument extends SvgNode {
    constructor() {
        super(DOCUMENT_NODE, null);
        this.ownerDocument = null;
        this.nodeName = '#document';
    }

    get documentElement() {
        return this.firstElementChild;
    }

    getElementById(id) {
        return this.querySelector(`#${id}`);
    }

    createElement(name) {
        return new SvgElement(name, this);
    }

    createElementNS(ns, name) {
        return new SvgElement(name, this);
    }

    createTextNode(data) {
        return new SvgText(data, this);
    }

    importNode(node, deep = false) {
        return node.cloneNode(deep);
    }
}

// ── Parsing ───────────────────────────────────────────────────────────────────
// parseSvg - an SvgDocument for XML text. A document that is not well formed
// comes back the way a browser's DOMParser answers it: a <parsererror> element
// as the document's root, saying what was wrong.
function parseSvg(text) {
    const doc = new SvgDocument();
    const source = String(text ?? '');
    const stack = [doc];
    const top = () => stack[stack.length - 1];
    const fail = message => {
        const failed = new SvgDocument();
        const error = failed.createElement('parsererror');
        error.appendChild(failed.createTextNode(message));
        failed.appendChild(error);
        return failed;
    };
    let i = 0;
    while (i < source.length) {
        if (source.startsWith('<!--', i)) {
            const end = source.indexOf('-->', i + 4);
            if (end < 0) return fail('a comment is not closed');
            i = end + 3;
        } else if (source.startsWith('<![CDATA[', i)) {
            const end = source.indexOf(']]>', i + 9);
            if (end < 0) return fail('a CDATA section is not closed');
            top().appendChild(new SvgText(source.slice(i + 9, end), doc));
            i = end + 3;
        } else if (source.startsWith('<?', i)) {
            const end = source.indexOf('?>', i + 2);
            if (end < 0) return fail('a processing instruction is not closed');
            i = end + 2;
        } else if (source.startsWith('<!', i)) {
            // A DOCTYPE, which may carry an internal subset in [ ... ].
            let depth = 0;
            let j = i + 2;
            for (; j < source.length; j++) {
                if (source[j] === '[') depth++;
                else if (source[j] === ']') depth--;
                else if (source[j] === '>' && depth <= 0) break;
            }
            i = j + 1;
        } else if (source.startsWith('</', i)) {
            const end = source.indexOf('>', i + 2);
            if (end < 0) return fail('a closing tag is not closed');
            const name = source.slice(i + 2, end).trim();
            const open = top();
            if (open === doc || open.nodeName !== name) {
                return fail(`</${name}> closes ${open === doc ? 'nothing' : `<${open.nodeName}>`}`);
            }
            stack.pop();
            i = end + 1;
        } else if (source[i] === '<') {
            const nameMatch = /^<([A-Za-z_][\w:.-]*)/.exec(source.slice(i, i + 256));
            if (!nameMatch) return fail(`a "<" at ${i} starts no tag`);
            const el = new SvgElement(nameMatch[1], doc);
            let j = i + nameMatch[0].length;
            const attr = /\s*([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')|\s*(\/?)>/y;
            let closed = false;
            let selfClosing = false;
            while (j < source.length) {
                attr.lastIndex = j;
                const m = attr.exec(source);
                if (!m) return fail(`<${el.nodeName}> has an attribute that cannot be read`);
                j = attr.lastIndex;
                if (m[1] !== undefined) {
                    el._attributes.set(m[1], decodeEntities(m[2] ?? m[3] ?? ''));
                } else {
                    closed = true;
                    selfClosing = m[4] === '/';
                    break;
                }
            }
            if (!closed) return fail(`<${el.nodeName}> is not closed`);
            top().appendChild(el);
            if (!selfClosing) stack.push(el);
            i = j;
        } else {
            const next = source.indexOf('<', i);
            const end = next < 0 ? source.length : next;
            const data = source.slice(i, end);
            if (top() !== doc) top().appendChild(new SvgText(decodeEntities(data), doc));
            else if (data.trim()) return fail('text outside the root element');
            i = end;
        }
    }
    if (stack.length !== 1) return fail(`<${top().nodeName}> is not closed`);
    if (!doc.documentElement) return fail('the document has no root element');
    return doc;
}

class DOMParser {
    parseFromString(text) {
        return parseSvg(text);
    }
}

// ── Serializing ───────────────────────────────────────────────────────────────
function serialize(node) {
    if (node.nodeType === TEXT_NODE) return escapeText(node.data);
    if (node.nodeType === DOCUMENT_NODE) return node.childNodes.map(serialize).join('');
    const attrs = [...node._attributes].map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('');
    if (!node.childNodes.length) return `<${node.nodeName}${attrs}/>`;
    return `<${node.nodeName}${attrs}>${node.childNodes.map(serialize).join('')}</${node.nodeName}>`;
}

class XMLSerializer {
    serializeToString(node) {
        return serialize(node);
    }
}

const Node = {
    ELEMENT_NODE, TEXT_NODE, DOCUMENT_NODE,
    DOCUMENT_POSITION_DISCONNECTED: POSITION.DISCONNECTED,
    DOCUMENT_POSITION_PRECEDING: POSITION.PRECEDING,
    DOCUMENT_POSITION_FOLLOWING: POSITION.FOLLOWING,
    DOCUMENT_POSITION_CONTAINS: POSITION.CONTAINS,
    DOCUMENT_POSITION_CONTAINED_BY: POSITION.CONTAINED_BY,
};

module.exports = { DOMParser, XMLSerializer, Node, SvgDocument, SvgElement, SvgText, parseSvg, compileSelector };

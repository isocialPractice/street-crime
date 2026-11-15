// js/ui/render-view.js - the render view, config/debug/renders.html
//
// A level design can draw an enemy with some parts of its art recolored (a
// pool entry's "render"), and in play each frame flashes past at game speed.
// This page shows every frame of every animation of each character a design
// draws, still and side by side: as drawn, then with the render, with the file
// name under it and any part the frame has no layer for, so it stays as drawn.
//
// The design is the one a SANDBOX TEST entry loads, picked from the same list
// (config/debug/sandbox.json). No game runs: the page loads the sprite, enemy
// and level design scripts, registers the design's variants as the sandbox
// does (enemyVariant), waits for their frames to decode, and draws each frame
// on a canvas of its own.
//
// One character a page; Left and Right, or the list, change it. The pages
// come from RENDER_VIEW_KINDS, one source per kind of character:
//   enemy     a page for each { enemy, render } the design's pools name
//   player    the player as drawn; nothing recolors the player yet
//   friendly  none until a level design can name them (characters.friendly
//   neutral   and characters.neutral are reserved, and must be false)
// A kind that gains characters gets a source of its own there.
//
// Opened as config/debug/renders.html?test=<sandbox test>&page=<n>, from the
// same server as the game.

const RENDER_VIEW_FRAME_H = 150;   // CSS px of the tallest frame on a page

const RENDER_VIEW_KINDS = [
    { kind: 'enemy',    label: 'Enemies',  pages: _renderViewEnemyPages,
      none: 'this design recolors no enemy' },
    { kind: 'player',   label: 'Player',   pages: _renderViewPlayerPages,
      none: 'no player frames loaded' },
    { kind: 'friendly', label: 'Friendly', pages: () => [],
      none: 'none yet; a level design cannot name friendly characters (characters.friendly is reserved)' },
    { kind: 'neutral',  label: 'Neutral',  pages: () => [],
      none: 'none yet; a level design cannot name neutral characters (characters.neutral is reserved)' },
];

// What is on screen: the sandbox's tests, the one picked, its design's pages
// and the page shown. state is 'loading' until a page is drawn, then 'ready'
// (also on <html data-render-view>, for a headless check to wait on).
const _renderView = { keys: [], tests: {}, key: null, design: null, warnings: [], notes: [], pages: [], index: 0, state: 'loading' };

// _renderViewRenderText - a render in words: "left-vest gray, right-vest gray".
function _renderViewRenderText(render) {
    return Object.entries(render || {})
        .map(([part, value]) => `${part} ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(', ');
}

function _renderViewFile(path) {
    return String(path || '').split('/').pop() || '(no file)';
}

// _renderViewEnemyPages - a page for each enemy and render the design draws.
// Its frames are paired with the base character's by animation and position:
// the variant is built from the same files, in the same order, recolored.
function _renderViewEnemyPages(design) {
    return levelDesignEnemyVariants(design).map(({ enemy, render }) => {
        const title = `${enemy}, ${_renderViewRenderText(render)}`;
        const id = enemyVariant(enemy, render);
        const def = id ? ENEMY_DEFS[id] : null;
        if (!def?.variantOf) {
            return { kind: 'enemy', title, render, anims: [],
                     problem: def ? 'the render recolors nothing' : `${enemy} is not an enemy with sprites to recolor` };
        }
        const drawn = ENEMY_CHARS[ENEMY_DEFS[def.variantOf].img];
        const rendered = ENEMY_CHARS[def.img];
        const anims = Object.entries(drawn?.animations || {}).map(([name, anim]) => ({
            name,
            mode: anim.mode,
            fallback: anim.fallbackState,
            frames: (anim.frames || []).map((img, i) => ({
                file: img.svgPath,
                drawn: img,
                rendered: rendered?.animations?.[name]?.frames?.[i] || null,
                report: variantFrameReport(img.svgPath, def.render),
            })),
        }));
        return { kind: 'enemy', title, id, render: def.render, anims };
    });
}

// _renderViewPlayerPages - the player's frames as drawn, grouped by their
// name in PLAYER (js/sprites/player.js) without its number, so walk0 to walk7
// are walk. Nothing recolors the player yet, so nothing is set beside them; an
// outfit's render would fill each frame's rendered and report.
function _renderViewPlayerPages() {
    const anims = new Map();
    for (const [key, img] of Object.entries(PLAYER)) {
        if (!img) continue;
        const name = key.replace(/\d+$/, '');
        if (!anims.has(name)) anims.set(name, { name, frames: [] });
        anims.get(name).frames.push({ file: img.svgPath, drawn: img, rendered: null, report: null });
    }
    if (!anims.size) return [];
    return [{ kind: 'player', title: 'Player', render: null, anims: [...anims.values()],
              note: 'As drawn: nothing recolors the player yet (player outfit and color select is planned).' }];
}

// renderViewPages - every page a design gives, kind by kind, and a note for
// each kind with none.
function renderViewPages(design) {
    const pages = [];
    const notes = [];
    for (const source of RENDER_VIEW_KINDS) {
        const found = source.pages(design);
        pages.push(...found);
        if (!found.length) {
            const why = source.kind === 'enemy' && !design ? 'this test loads no level design' : source.none;
            notes.push(`${source.label}: ${why}`);
        }
    }
    return { pages, notes };
}

// _renderViewDesign - the test's design as the sandbox reads it (a draft is
// converted), and what its checks say about it.
function _renderViewDesign(test) {
    const path = typeof test?.design === 'string' && test.design.trim() ? test.design.trim() : null;
    if (!path) return { design: null, warnings: [] };
    const loaded = loadLevelDesign(path);
    if (!loaded.design) return { design: null, warnings: loaded.warnings };
    const prepared = prepareLevelDesign(loaded.design);
    return { design: prepared.design, warnings: [...loaded.warnings, ...prepared.warnings] };
}

function _renderViewImages(pages) {
    return pages.flatMap(page => page.anims.flatMap(anim =>
        anim.frames.flatMap(frame => [frame.drawn, frame.rendered]))).filter(Boolean);
}

function _renderViewEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function _renderViewSize(img) {
    return { w: img?.authoredW || img?.naturalWidth || 0, h: img?.authoredH || img?.naturalHeight || 0 };
}

// _renderViewCanvas - one frame drawn at scale (CSS px per SVG unit), sharp
// on a high-density screen. A frame that did not decode is an empty box.
function _renderViewCanvas(img, scale, className) {
    const { w, h } = _renderViewSize(img);
    const canvas = _renderViewEl('canvas', className);
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.round(w * scale));
    const cssH = Math.max(1, Math.round(h * scale));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // Width only: the height follows the bitmap's shape, so a frame the page
    // shrinks to fit a narrow screen keeps it.
    canvas.style.width = `${cssW}px`;
    if (img?.naturalWidth > 0) canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    else canvas.classList.add('rv-blank');
    return canvas;
}

// _renderViewCaption - the lines under a frame: its file, then what the
// render did to it.
function _renderViewCaption(frame) {
    const caption = _renderViewEl('figcaption');
    caption.append(_renderViewEl('div', 'rv-file', _renderViewFile(frame.file)));
    const report = frame.report;
    if (!report) return caption;
    if (report.missing.length) caption.append(_renderViewEl('div', 'rv-warn', `keeps as drawn: ${report.missing.join(', ')}`));
    for (const { part, used } of report.fallbacks) caption.append(_renderViewEl('div', 'rv-muted', `${part} found as ${used}`));
    for (const problem of report.problems) caption.append(_renderViewEl('div', 'rv-warn', problem));
    const shapes = `${report.recolored} shape${report.recolored === 1 ? '' : 's'} recolored`;
    caption.append(_renderViewEl('div', report.recolored ? 'rv-muted' : 'rv-warn', shapes));
    return caption;
}

// _renderViewKeeps - each file on a page that keeps a part as drawn, once,
// with the parts.
function _renderViewKeeps(page) {
    const byFile = new Map();
    for (const anim of page.anims) {
        for (const frame of anim.frames) {
            if (frame.report?.missing.length) byFile.set(_renderViewFile(frame.file), frame.report.missing);
        }
    }
    return [...byFile.entries()];
}

function _renderViewSummary(page) {
    const frames = page.anims.flatMap(anim => anim.frames);
    const files = new Set(frames.map(frame => frame.file));
    const withFrames = page.anims.filter(anim => anim.frames.length).length;
    let text = `${frames.length} frames in ${withFrames} animations, from ${files.size} files`;
    if (page.render) {
        const keeps = _renderViewKeeps(page);
        text += keeps.length
            ? `; ${keeps.length} file${keeps.length === 1 ? ' keeps' : 's keep'} a part as drawn: `
              + keeps.map(([file, parts]) => `${file} (${parts.join(', ')})`).join(', ')
            : '; every file takes the render';
    }
    return text;
}

// _renderViewPage - the page's grid: an animation a row, a frame a cell, the
// as-drawn frame and the recolored one side by side, every frame on the page
// at one scale so their sizes compare.
function _renderViewPage(page) {
    const out = _renderViewEl('div', 'rv-page');
    out.dataset.kind = page.kind;
    out.dataset.title = page.title;
    if (page.problem) {
        out.append(_renderViewEl('p', 'rv-warn', page.problem));
        return out;
    }
    if (page.note) out.append(_renderViewEl('p', 'rv-muted', page.note));
    out.append(_renderViewEl('p', 'rv-summary', _renderViewSummary(page)));

    const tallest = Math.max(1, ...page.anims.flatMap(anim => anim.frames.map(frame => _renderViewSize(frame.drawn).h)));
    const scale = RENDER_VIEW_FRAME_H / tallest;
    for (const anim of page.anims) {
        const section = _renderViewEl('section', 'rv-anim');
        const heading = _renderViewEl('h3', '', anim.name);
        if (anim.mode) heading.append(_renderViewEl('span', 'rv-muted', ` ${anim.mode}`));
        section.append(heading);
        if (!anim.frames.length) {
            section.append(_renderViewEl('div', 'rv-muted',
                anim.fallback ? `no frames of its own; draws ${anim.fallback}` : 'no frames'));
            out.append(section);
            continue;
        }
        const row = _renderViewEl('div', 'rv-row');
        for (const frame of anim.frames) {
            const cell = _renderViewEl('figure', 'rv-frame');
            cell.dataset.file = _renderViewFile(frame.file);
            if (frame.report?.missing.length) {
                cell.classList.add('rv-keeps');
                cell.dataset.missing = frame.report.missing.join(',');
            }
            const pair = _renderViewEl('div', 'rv-pair');
            pair.style.height = `${RENDER_VIEW_FRAME_H}px`;
            pair.append(_renderViewCanvas(frame.drawn, scale, 'rv-drawn'));
            if (frame.rendered) pair.append(_renderViewCanvas(frame.rendered, scale, 'rv-rendered'));
            cell.append(pair, _renderViewCaption(frame));
            row.append(cell);
        }
        section.append(row);
        out.append(section);
    }
    return out;
}

function _renderViewSetState(state) {
    _renderView.state = state;
    document.documentElement.dataset.renderView = state;
}

// _renderViewShow - draw page index (wrapping), and keep the address and the
// lists in step, so a reload or a shared link opens the same page.
function _renderViewShow(index) {
    const { pages } = _renderView;
    _renderView.index = pages.length ? ((index % pages.length) + pages.length) % pages.length : 0;
    const pageSelect = document.getElementById('rv-page');
    pageSelect.value = String(_renderView.index);
    const grid = document.getElementById('rv-grid');
    grid.replaceChildren(pages.length ? _renderViewPage(pages[_renderView.index]) : _renderViewEl('p', 'rv-muted', 'nothing to show'));
    const url = new URL(location.href);
    url.searchParams.set('test', _renderView.key);
    url.searchParams.set('page', String(_renderView.index));
    history.replaceState(null, '', url);
    _renderViewSetState('ready');
}

function _renderViewStatus(text, isProblem = false) {
    const status = document.getElementById('rv-status');
    status.textContent = text;
    status.classList.toggle('rv-warn', isProblem);
}

// _renderViewLoad - read the test's design, register its variants, wait for
// every frame to decode, and show page index.
async function _renderViewLoad(key, index = 0) {
    _renderViewSetState('loading');
    _renderView.key = key;
    document.getElementById('rv-test').value = key;
    _renderViewStatus('loading...');

    const test = _renderView.tests[key];
    const { design, warnings } = _renderViewDesign(test);
    const { pages, notes } = renderViewPages(design);
    Object.assign(_renderView, { design, warnings, notes, pages });
    await Promise.all(_renderViewImages(pages).map(img => (img.decode ? img.decode().catch(() => {}) : null)));
    if (_renderView.key !== key) return;   // another test was picked meanwhile

    const label = typeof test?.label === 'string' && test.label.trim() ? test.label.trim() : key;
    _renderViewStatus(`${label}${test?.design ? ` (${test.design})` : ''}: design: ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
    const list = document.getElementById('rv-warnings');
    list.replaceChildren(...warnings.map(w => _renderViewEl('li', '', w)));
    list.parentElement.hidden = !warnings.length;
    document.getElementById('rv-notes').replaceChildren(...notes.map(n => _renderViewEl('li', 'rv-muted', n)));

    const pageSelect = document.getElementById('rv-page');
    pageSelect.replaceChildren(...pages.map((page, i) => {
        const option = _renderViewEl('option', '', `${page.kind}: ${page.title}`);
        option.value = String(i);
        return option;
    }));
    _renderViewShow(index);
}

function _renderViewWire() {
    document.getElementById('rv-test').addEventListener('change', e => _renderViewLoad(e.target.value));
    document.getElementById('rv-page').addEventListener('change', e => _renderViewShow(Number(e.target.value)));
    document.getElementById('rv-prev').addEventListener('click', () => _renderViewShow(_renderView.index - 1));
    document.getElementById('rv-next').addEventListener('click', () => _renderViewShow(_renderView.index + 1));
    window.addEventListener('keydown', e => {
        // A focused list already moves with the arrows.
        if (e.target.closest?.('select, input, textarea') || _renderView.state !== 'ready') return;
        if (e.code === 'ArrowLeft')  { e.preventDefault(); _renderViewShow(_renderView.index - 1); }
        if (e.code === 'ArrowRight') { e.preventDefault(); _renderViewShow(_renderView.index + 1); }
    });
}

(async () => {
    try {
        await ASSETS_READY;
        const read = _readSandboxConfig();
        const tests = read.config && typeof read.config.tests === 'object' && read.config.tests ? read.config.tests : {};
        _renderView.tests = tests;
        _renderView.keys = Object.keys(tests);
        if (!_renderView.keys.length) {
            _renderViewStatus(read.problem || `${SANDBOX_CONFIG_PATH} lists no tests`, true);
            _renderViewSetState('ready');
            return;
        }
        document.getElementById('rv-test').replaceChildren(..._renderView.keys.map(k => {
            const option = _renderViewEl('option', '', k);
            option.value = k;
            return option;
        }));
        _renderViewWire();
        const params = new URLSearchParams(location.search);
        const asked = params.get('test');
        const key = _renderView.keys.includes(asked) ? asked
            : _renderView.keys.includes(read.config.active) ? read.config.active : _renderView.keys[0];
        await _renderViewLoad(key, Number(params.get('page')) || 0);
    } catch (e) {
        console.error('[render-view]', e);
        _renderViewStatus(`the view could not load: ${e.message}`, true);
        _renderViewSetState('ready');
    }
})();

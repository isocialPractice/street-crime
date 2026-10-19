// js/ui/sandbox.js - SANDBOX TEST, a debug harness driven by a config file
//
// The sandbox is where a feature is tried on its own before it is part of a
// stage: one scene, one player, the debug panels, and a checklist of what the
// feature is supposed to do. What it loads is not written here but in
// config/debug/sandbox.json:
//
//   { "active": "level-mapping",
//     "tests": { "level-mapping": { "level": "assets/levels/theStreets/",
//                                   "scene": "level-theStreets.svg", ... } } }
//
// Each entry under "tests" is one setup, and "active" is the one the title
// menu starts. The panel can restart into any of the others. Adding a test for
// a new feature is a new entry in that file, not a change here.
//
// The file is read again on every start and on RESTART, so a test can be
// adjusted and rerun without reloading the page.

const SANDBOX_CONFIG_PATH = 'config/debug/sandbox.json';

// What a test may leave out. Only "level" and "scene" have no default, since
// without them there is nothing to load.
const SANDBOX_TEST_DEFAULTS = {
    sectionWidth: 800,
    worldHeight:  600,
    spawn:      { minX: 60, maxX: 220 },
    panels:     { debug: true, checklist: true },
    cfg:        {},
    levelMap:   { enabled: true, animate: {} },
    enterables: {},
    enemies:    [],
    checklist:  [],
};

// The test run when the file cannot supply one, so a typo in the config still
// lands somewhere playable with the reason on screen, rather than on a title
// screen that silently refuses to start.
const SANDBOX_FALLBACK_KEY  = 'level-mapping';
const SANDBOX_FALLBACK_TEST = {
    label: 'Level mapping: The Streets (built-in)',
    level: 'assets/levels/theStreets/',
    scene: 'level-theStreets.svg',
};

let _sandboxRun      = null;   // { key, keys, test, stage, problem } of the test being played
let _sandboxStarting = false;  // a start is waiting on image decode; ignore repeat presses
const _sandboxScenes = new Map();

function _sandboxIsObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function _sandboxEsc(value) {
    return String(value).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// _readSandboxConfig - the parsed file, or the reason there is none. The same
// synchronous read config/levels.json gets (js/level/sequence.js), with the
// cache told to check back so an edit shows up on the next RESTART.
function _readSandboxConfig() {
    let text = '';
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', SANDBOX_CONFIG_PATH, false);
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.send();
        // Status 0 with a body is the only "found" there is over file://.
        const ok = (xhr.status >= 200 && xhr.status < 300)
                || (xhr.status === 0 && !!xhr.responseText);
        if (!ok) return { problem: `${SANDBOX_CONFIG_PATH} could not be read (status ${xhr.status})` };
        text = xhr.responseText;
    } catch (e) {
        return { problem: `${SANDBOX_CONFIG_PATH} could not be read` };
    }
    try {
        return { config: JSON.parse(text) };
    } catch (e) {
        return { problem: `${SANDBOX_CONFIG_PATH} is not valid JSON (${e.message})` };
    }
}

// _sandboxWithDefaults - a test with every key filled in. Objects merge one
// level deep, so a test that sets only "spawn": { "minX": 300 } keeps the
// default maxX instead of losing it. A value of the wrong shape is replaced by
// the default rather than passed on to code that would trip over it.
function _sandboxWithDefaults(test) {
    const out = { ...test };
    for (const [key, fallback] of Object.entries(SANDBOX_TEST_DEFAULTS)) {
        const value = test[key];
        if (_sandboxIsObject(fallback)) {
            out[key] = _sandboxIsObject(value) ? { ...fallback, ...value } : { ...fallback };
        } else if (Array.isArray(fallback)) {
            out[key] = Array.isArray(value) ? value : [];
        } else {
            out[key] = Number.isFinite(value) && value > 0 ? value : fallback;
        }
    }
    if (!out.level.endsWith('/')) out.level += '/';
    return out;
}

// _sandboxTestProblem - why a test cannot run as written, or null.
function _sandboxTestProblem(config, tests, keys, key) {
    if (!tests) return `${SANDBOX_CONFIG_PATH} has no "tests" object`;
    if (!keys.length) return `${SANDBOX_CONFIG_PATH} lists no tests`;
    if (!_sandboxIsObject(tests[key])) return `${SANDBOX_CONFIG_PATH} has no test named "${key}"`;
    const { level, scene } = tests[key];
    if (typeof level !== 'string' || !level.trim() || typeof scene !== 'string' || !scene.trim()) {
        return `test "${key}" in ${SANDBOX_CONFIG_PATH} needs "level" and "scene"`;
    }
    return null;
}

// _sandboxSceneProblem - why a test's scene file cannot be loaded, or null.
// The text it reads goes straight into the loader's cache, so createSvgScene
// does not fetch the same 300 KB file a second time.
function _sandboxSceneProblem(test) {
    const path = test.level + test.scene;
    if (_svgTextCache.has(path)) return null;
    const text = _readSvgFileSync(path);
    if (text === null) return `scene ${path} could not be read`;
    _svgTextCache.set(path, text);
    return null;
}

// _loadSandboxTest - the test to run and what the panel needs to say about
// it. Any failure (file, JSON, test name, missing level or scene, scene file)
// falls back to the built-in test and keeps the reason for the status line: a
// sandbox that will not start tells nobody anything.
function _loadSandboxTest(requestedKey) {
    const read  = _readSandboxConfig();
    const tests = _sandboxIsObject(read.config?.tests) ? read.config.tests : null;
    const keys  = tests ? Object.keys(tests) : [];
    let key     = requestedKey || read.config?.active || keys[0];
    let problem = read.problem || _sandboxTestProblem(read.config, tests, keys, key);
    let test    = problem ? null : _sandboxWithDefaults(tests[key]);

    if (test) problem = _sandboxSceneProblem(test);
    if (problem) {
        console.warn('[sandbox] %s; running the built-in test instead', problem);
        key  = SANDBOX_FALLBACK_KEY;
        test = _sandboxWithDefaults(SANDBOX_FALLBACK_TEST);
        _sandboxSceneProblem(test);
    }
    test.label = (typeof test.label === 'string' && test.label.trim()) ? test.label.trim() : key;
    return { key, keys: keys.includes(key) ? keys : [key, ...keys], test, problem };
}

// _sandboxScene - the scene a test draws, built the first time it is asked
// for and reused after that. Building parses the whole level SVG, which is
// worth doing once per page rather than on every restart.
function _sandboxScene(test) {
    const path = test.level + test.scene;
    const levelMap = !!test.levelMap.enabled;
    const cacheKey = [path, test.sectionWidth, test.worldHeight, levelMap].join('|');
    if (!_sandboxScenes.has(cacheKey)) {
        _sandboxScenes.set(cacheKey, createSvgScene({
            path,
            worldWidth:  test.sectionWidth,
            worldHeight: test.worldHeight,
            levelMap,
            levelDir:    test.level,
        }));
    }
    return _sandboxScenes.get(cacheKey);
}

// Every image a scene draws, animation frames and breakables included, so a
// start can wait for them to decode and the first frame is the level rather
// than a blank canvas.
function _sandboxSceneImages(scene) {
    return [
        scene.img,
        ...(scene.sections || []).map(section => section.img),
        ...levelSceneAnimations(scene).flatMap(anim => anim.frames),
        ...Object.values(levelSceneBreakableSprites(scene)).flatMap(Object.values),
    ].filter(Boolean);
}

// Only finite numbers reach the spawn sampler; a stray string there would turn
// its bounds into NaN and the player would never be placed.
function _sandboxSpawnOptions(spawn) {
    const out = {};
    for (const key of ['minX', 'maxX', 'minY', 'maxY']) {
        if (Number.isFinite(spawn[key])) out[key] = spawn[key];
    }
    return out;
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function _sandboxPanelHtml(run) {
    const options = run.keys
        .map(k => `<option value="${_sandboxEsc(k)}"${k === run.key ? ' selected' : ''}>${_sandboxEsc(k)}</option>`)
        .join('');
    const rows = run.test.checklist
        .filter(item => _sandboxIsObject(item) && typeof item.event === 'string')
        .map(item => `<div class="dbg-check" data-event="${_sandboxEsc(item.event)}">`
                   + `${_sandboxEsc(item.label || item.event)}</div>`)
        .join('');
    return `
        <div id="sbx-panel">
            <div class="dbg-section">SANDBOX TEST</div>
            <div class="dbg-subsection">${_sandboxEsc(run.test.label)}</div>
            <select class="dbg-enemy-select" id="sbx-test-select">${options}</select>
            <button class="dbg-spawn-btn" id="sbx-restart">&#8635; RESTART</button>
            <div class="dbg-status" id="sbx-status"></div>
            <div class="dbg-subsection">CHECKLIST</div>
            <div id="sbx-checklist">${rows || '<div class="dbg-status">this test has no checklist</div>'}</div>
        </div>`;
}

// _buildSandboxPanels - the debug panels a test asks for, with the sandbox
// block on top of the left one. buildDebugLeftPanel replaces that panel's
// contents, so the block is added after it, every time.
function _buildSandboxPanels(run) {
    const { panels } = run.test;
    const dbgPanel  = document.getElementById('debug-panel');
    const leftPanel = document.getElementById('debug-left-panel');

    if (panels.debug) {
        buildDebugPanel();
        buildDebugLeftPanel();
    } else {
        leftPanel.innerHTML = '';
    }
    dbgPanel.classList.toggle('hidden', !panels.debug);

    if (panels.checklist) {
        leftPanel.insertAdjacentHTML('afterbegin', _sandboxPanelHtml(run));
        const select  = document.getElementById('sbx-test-select');
        const restart = document.getElementById('sbx-restart');
        // Both give up focus once used. A focused button is pressed again by
        // Space or Enter, and a focused select changes with the arrow keys,
        // which are also how the player jumps and moves.
        select.addEventListener('change', () => select.blur());
        restart.addEventListener('click', () => {
            restart.blur();
            startSandbox(select.value);
        });
        if (!panels.debug) makeDebugPanelResizable(leftPanel, 'left');
    }
    leftPanel.classList.toggle('hidden', !panels.debug && !panels.checklist);
    _sandboxStatus(run.problem || `${run.test.label}: loading`, !!run.problem);
}

function _sandboxStatus(text, isProblem = false) {
    const el = document.getElementById('sbx-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('problem', isProblem);
}

// sandboxMark - tick the checklist rows waiting on an event, such as
// "break:parking-gate-arm". Features report through the level map's event bus,
// but anything may call this directly.
function sandboxMark(event) {
    document.querySelectorAll('#sbx-checklist .dbg-check').forEach(row => {
        if (row.dataset.event === event) row.classList.add('done');
    });
}

function _sandboxClearChecklist() {
    document.querySelectorAll('#sbx-checklist .dbg-check.done')
        .forEach(row => row.classList.remove('done'));
}

// Features report through the level map's event bus, and the checklist ticks
// off whatever it hears. Rows only exist while a sandbox panel is up, so the
// listener is harmless in every other mode.
LEVEL_MAP_EVENTS.addEventListener('levelmap', e => sandboxMark(e.detail.event));

// _sandboxReportMap - print what the level map found and return the summary
// for the status line. The table is the quickest way to check a layer named in
// Illustrator against where the game placed it; the debug overlay shows the
// same boxes on the level itself.
function _sandboxReportMap(scene) {
    const map = scene.map;
    if (!map) return '';
    console.log('[sandbox] Level map of %s', scene.path);
    console.table(map.regions.map(r => ({
        id: r.id, kind: r.kind, parent: r.parent || '',
        x: +r.world.x.toFixed(1), y: +r.world.y.toFixed(1),
        w: +r.world.w.toFixed(1), h: +r.world.h.toFixed(1),
    })));
    map.warnings.forEach(text => console.warn('[level-map] %s', text));
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    return `${plural(map.regions.length, 'region')}, ${plural(map.warnings.length, 'warning')}`;
}

// ── Start / restart ───────────────────────────────────────────────────────────
function _sandboxSpawnEnemies(list) {
    const stageData = getCurrentStageData();
    list.forEach((typeId, i) => {
        const def = ENEMY_DEFS[typeId];
        if (!def) {
            console.warn('[sandbox] Ignoring enemy "%s": not in ENEMY_DEFS', typeId);
            return;
        }
        const feetX = player.x + player.w * 0.5;
        const spawn = sampleStageEntityPosition(stageData, def.w, def.h, {
            minX: feetX + 120 + i * 60,
            maxX: feetX + 280 + i * 60,
        }) || sampleStageEntityPosition(stageData, def.w, def.h);
        enemies.push(spawn ? new Enemy(spawn.x, spawn.y, typeId)
                           : new Enemy(player.x + 280, player.y, typeId));
    });
}

// startSandbox - the SANDBOX TEST menu entry, and RESTART in its panel.
// Async only to wait for the scene images to decode; a second press while that
// wait is running is ignored rather than starting the test twice.
async function startSandbox(requestedKey) {
    if (_sandboxStarting) return;
    _sandboxStarting = true;
    try {
        const run = _loadSandboxTest(requestedKey);

        debugMode = true;
        document.getElementById('title-screen').classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        // Before the panels, so their sliders and toggles show the test's values.
        Object.assign(CFG, run.test.cfg);
        _buildSandboxPanels(run);

        const scene = _sandboxScene(run.test);
        // A first start decodes the whole level image, which takes a second or
        // so; the loading screen says so rather than leaving a blank canvas.
        // It only comes up if the wait runs long, so a restart from cache (a
        // few ms) does not flash it.
        const loading = document.getElementById('loading-screen');
        const showLoading = setTimeout(() => { loading.style.display = ''; }, 150);
        await Promise.all(_sandboxSceneImages(scene)
            .map(img => (img.decode ? img.decode().catch(() => {}) : null)));
        clearTimeout(showLoading);
        loading.style.display = 'none';

        // A fallback's reason outranks the map summary; warnings in the map
        // get the same color, since both mean something is not as written.
        const summary = _sandboxReportMap(scene);
        const warned = !!scene.map?.warnings.length;
        _sandboxStatus(run.problem || [`${run.test.label}: ready`, summary].filter(Boolean).join(', '),
                       !!run.problem || warned);

        // The stage carries the test's levelMap settings, which is where the
        // level runtime and the animation pass read things like a sign's fps.
        run.stage = { name: `SANDBOX: ${run.test.label}`, scene, levelMap: run.test.levelMap };
        _sandboxRun = run;
        initSandbox();
    } catch (e) {
        console.error('[sandbox] Could not start', e);
        _sandboxStatus(`could not start: ${e.message}`, true);
    } finally {
        _sandboxStarting = false;
    }
}

// initSandbox - put the current test back to its starting state. Also what
// Enter calls after a game over, through debugRestart.
function initSandbox() {
    if (!_sandboxRun) return;
    const { stage, test } = _sandboxRun;
    _resetDebugPlayfield(stage, 'SBX');
    if (stage.scene.map) {
        // A door that cannot be gone through says why on the status line, where
        // the person testing it is looking, as well as in the console.
        levelRuntime = new LevelMapRuntime(stage, {
            enterables: test.enterables,
            notify: text => {
                console.warn('[level-map] %s', text);
                _sandboxStatus(text, true);
            },
        });
        breakables = levelRuntime.breakables;
    }
    // RESTART can be clicked while paused, and nothing else would clear this.
    pauseOverlay.classList.add('hidden');

    player = new Player(120, 445);
    const spawn = sampleStageEntityPosition(stage, player.w, player.h, _sandboxSpawnOptions(test.spawn));
    if (spawn) {
        player.x = spawn.x;
        player.y = spawn.y;
    }
    _hpHUD(player);
    livesEl.textContent = player.lives;

    _sandboxSpawnEnemies(test.enemies);
    debugRestart = initSandbox;
    _sandboxClearChecklist();
}

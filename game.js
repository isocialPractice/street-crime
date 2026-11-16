// game.js — Street Crime: Beat 'Em Up
// Main entry point: game state variables, game loop, stage/game init, and boot.
// All subsystems are loaded before this file via <script> tags in index.html.

// ── Top-level game state ──────────────────────────────────────────────────────
let score = 0;
let gameState = 'title'; // 'title' | 'playing' | 'paused' | 'stageclear' | 'gameover'
                         // | 'victory' | 'sequencegap' (config/levels.json names a
                         // level the game cannot produce; see js/level/sequence.js)
let currentStageIdx = 0;
let currentStageData = null;
let debugMode = false;
// The debug start that Enter on a game-over overlay goes back to. Each debug
// mode sets it to its own init, so a run ends where it began instead of always
// in the arena. Null falls back to the arena.
let debugRestart = null;

function getCurrentStageData() {
    return currentStageData || STAGES[currentStageIdx] || null;
}

function addScore(n) {
    score += Math.round(n * CFG.scoreMultiplier);
    scoreEl.textContent = String(score).padStart(6, '0');
}

// ── Live game object arrays ───────────────────────────────────────────────────
let player, enemies, effects, breakables, pickups, levelMgr;
// What the current scene's level map is doing (js/level/level-runtime.js), or
// null when the scene has no level map.
let levelRuntime = null;
// What the current level's design is doing (js/level/level-design.js), or null
// when it has none. Runs alongside levelRuntime and reports through it.
let levelDirector = null;
let lastTime = 0;

// clearLevelDirector - stop the current level design listening, before the
// level it ran on is replaced.
function clearLevelDirector() {
    if (levelDirector) levelDirector.dispose();
    levelDirector = null;
}

// ── Stage / game init ─────────────────────────────────────────────────────────
// initStage resets all per-stage state. Arrays are replaced (not cleared in-place)
// because other code may still hold references to the old arrays mid-frame.
function initStage(idx) {
    currentStageIdx = idx;
    currentStageData = STAGES[idx];
    stageEl.textContent = idx + 1;
    cam.x = 0; cam.power = 0;

    enemies    = [];
    effects    = [];
    breakables = [];
    pickups    = [];
    levelMgr   = new LevelMgr(idx);
    levelRuntime = null;
    clearLevelDirector();

    hideOverlay();
    _hideBossHUD();
    _updateComboHUD(0);
    // Reset the per-level stamina recharge counter and refill the bar so each
    // new stage starts with a fresh allotment of run-kicks.
    if (player) {
        player.stamina = 1;
        player.stamCD  = 0;
        player.rechargeCountLevel = 0;
    }
    gameState = 'playing';
}

// The render view (js/ui/render-view.js), a page of its own beside the game.
const RENDER_VIEW_PAGE = 'config/debug/renders.html';

// ── Title screen menu ──────────────────────────────────────────────────
// The first list, and the ones SETTINGS and DEBUG MODES open. BACK, or
// Escape, returns to the first with the entry that opened the list highlighted.
const titleMenu = new Menu({
    main: {
        el: 'title-list-main',
        items: [
            { id: 'btn-game',         start: () => startGame(false)                       },
            { id: 'btn-settings',     start: () => titleMenu.show('settings')             },
            { id: 'btn-debug-modes',  start: () => titleMenu.show('debug')                },
            { id: 'btn-sandbox',      start: () => startSandbox()                         },
        ],
    },
    settings: {
        el: 'title-list-settings',
        back: () => titleMenu.show('main', 'btn-settings'),
        items: [
            { id: 'btn-set-difficulty', start: () => changeSetting('difficulty', 1),
              change: dir => changeSetting('difficulty', dir) },
            { id: 'btn-settings-back', start: () => titleMenu.show('main', 'btn-settings') },
        ],
    },
    debug: {
        el: 'title-list-debug',
        back: () => titleMenu.show('main', 'btn-debug-modes'),
        items: [
            { id: 'btn-debug',        start: () => startGame(true)                        },
            { id: 'btn-debug-level',  start: () => startDebugLevel()                      },
            { id: 'btn-debug-render', start: () => location.assign(RENDER_VIEW_PAGE)      },
            { id: 'btn-debug-back',   start: () => titleMenu.show('main', 'btn-debug-modes') },
        ],
    },
});

// ── Pause menu ─────────────────────────────────────────────────────────
// What the title screen offers, over the paused run, with RESUME first and
// EXIT last. SETTINGS opens over the run and comes back to pause; the other
// entries leave the run (leaveRun), which in GAME asks first. P, Escape on the
// first list, and the pause button resume; Escape elsewhere steps back.
const pauseMenu = new Menu({
    main: {
        el: 'pause-list-main',
        items: [
            { id: 'pbtn-resume',      start: () => togglePause()                                      },
            { id: 'pbtn-game',        start: () => leaveRun(() => startGame(false), 'main', 'pbtn-game') },
            { id: 'pbtn-settings',    start: () => pauseMenu.show('settings')                         },
            { id: 'pbtn-debug-modes', start: () => pauseMenu.show('debug')                            },
            { id: 'pbtn-sandbox',     start: () => leaveRun(() => startSandbox(), 'main', 'pbtn-sandbox') },
            { id: 'pbtn-exit',        start: () => leaveRun(exitToTitle(), 'main', 'pbtn-exit')       },
        ],
    },
    settings: {
        el: 'pause-list-settings',
        back: () => pauseMenu.show('main', 'pbtn-settings'),
        items: [
            { id: 'pbtn-set-difficulty', start: () => changeSetting('difficulty', 1),
              change: dir => changeSetting('difficulty', dir) },
            { id: 'pbtn-settings-back', start: () => pauseMenu.show('main', 'pbtn-settings') },
        ],
    },
    debug: {
        el: 'pause-list-debug',
        back: () => pauseMenu.show('main', 'pbtn-debug-modes'),
        items: [
            { id: 'pbtn-debug',        start: () => leaveRun(() => startGame(true), 'debug', 'pbtn-debug')          },
            { id: 'pbtn-debug-level',  start: () => leaveRun(() => startDebugLevel(), 'debug', 'pbtn-debug-level') },
            { id: 'pbtn-debug-render', start: () => leaveRun(() => location.assign(RENDER_VIEW_PAGE), 'debug', 'pbtn-debug-render') },
            { id: 'pbtn-debug-back',   start: () => pauseMenu.show('main', 'pbtn-debug-modes')                     },
        ],
    },
    // QUIT? in GAME, before leaving: NO goes back to the entry it came from.
    confirm: {
        el: 'pause-list-confirm',
        back: () => cancelLeave(),
        items: [
            { id: 'pbtn-no',  start: () => cancelLeave()  },
            { id: 'pbtn-yes', start: () => confirmLeave() },
        ],
    },
});

// ── Runs ───────────────────────────────────────────────────────────────
// The mode being played, and where each is started on the title screen:
// EXIT from pause goes back there, with that entry highlighted.
let runMode = null;   // 'game' | 'debug' | 'debug-level' | 'sandbox'
const RUN_MODE_HOME = {
    'game':        { list: 'main',  id: 'btn-game' },
    'debug':       { list: 'debug', id: 'btn-debug' },
    'debug-level': { list: 'debug', id: 'btn-debug-level' },
    'sandbox':     { list: 'main',  id: 'btn-sandbox' },
};

// CFG as config/ left it at boot (the Boot handler below): what leaving a run
// puts back, so SANDBOX TEST's cfg and the debug sliders do not carry over.
let CFG_BOOT = null;

let pendingLeave = null;   // { next, list, id } while QUIT? is asked

// exitToTitle - what EXIT does once the run is gone: the title screen, at the
// entry the mode was started from. Made before the run ends, which forgets it.
function exitToTitle() {
    const home = RUN_MODE_HOME[runMode] || RUN_MODE_HOME.game;
    return () => {
        document.getElementById('title-screen').classList.remove('hidden');
        titleMenu.show(home.list, home.id);
        gameState = 'title';
    };
}

// leaveRun - end the run in progress and do next(). In GAME it asks first,
// from the entry (list, id) that asked, so NO can go back to it.
function leaveRun(next, list, id) {
    if (runMode === 'game') {
        pendingLeave = { next, list, id };
        pauseMenu.show('confirm', 'pbtn-no');
        return;
    }
    endRun();
    next();
}

function confirmLeave() {
    const leave = pendingLeave;
    pendingLeave = null;
    if (!leave) return;
    endRun();
    leave.next();
}

function cancelLeave() {
    const leave = pendingLeave;
    pendingLeave = null;
    pauseMenu.show(leave?.list || 'main', leave?.id || 'pbtn-resume');
}

// endRun - undo what starting a mode set up, so another can start clean or the
// title can show: the level and its director, the overlays, the debug and
// sandbox panels, and CFG back to what config/ gave at boot.
function endRun() {
    clearLevelDirector();
    levelRuntime = null;
    levelMgr = null;
    GameUI.close();
    enemies = []; effects = []; breakables = []; pickups = [];
    hideOverlay();
    _hideBossHUD();
    pauseOverlay.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    document.getElementById('debug-panel').classList.add('hidden');
    document.getElementById('debug-left-panel').classList.add('hidden');
    debugMode = false;
    debugRestart = null;
    _sandboxRun = null;
    if (CFG_BOOT) Object.assign(CFG, CFG_BOOT);
    // The live weather is not tuning: lay its last reading back over the boot values.
    localWeatherReapply();
    runMode = null;
    pendingLeave = null;
    gameState = 'title';
}

// initMenus - wire both menus, and send each keydown to the one on screen. One
// listener decides which, before either acts, so a choice that changes screens
// (EXIT shows the title) is never also read by the other menu.
function initMenus() {
    titleMenu.wire();
    pauseMenu.wire();
    showSettingValues();
    titleMenu.show('main');
    window.addEventListener('keydown', e => {
        if (gameState === 'title') titleMenu.onKey(e);
        else if (gameState === 'paused') pauseMenu.onKey(e, { escape: false });
    });
}

// The modes a link can start, by the names runMode uses.
const START_MODES = {
    'game':        () => startGame(false),
    'debug':       () => startGame(true),
    'debug-level': () => startDebugLevel(),
    'sandbox':     () => startSandbox(),
};

// openFromAddress - what a page beside the game asks for in the address (the
// render view's pause menu, js/ui/render-view.js): ?start=<mode> starts a
// mode, ?menu=<list>&select=<entry id> opens a title list at that entry. The
// address is cleared after, so a reload opens the title screen.
function openFromAddress() {
    const params = new URLSearchParams(location.search);
    const start = params.get('start');
    const menu  = params.get('menu');
    if (!start && !menu) return;
    history.replaceState(null, '', location.pathname);
    if (Object.hasOwn(START_MODES, start)) START_MODES[start]();
    else if (Object.hasOwn(titleMenu.lists, menu)) titleMenu.show(menu, params.get('select'));
}

function startGame(isDebug) {
    debugMode = isDebug;
    runMode = isDebug ? 'debug' : 'game';
    startRunSettings(!isDebug);
    document.getElementById('title-screen').classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    const dbgPanel     = document.getElementById('debug-panel');
    const dbgLeftPanel = document.getElementById('debug-left-panel');
    if (isDebug) {
        buildDebugPanel();
        dbgPanel.classList.remove('hidden');
        buildDebugLeftPanel();
        dbgLeftPanel.classList.remove('hidden');
        initDebugArena();
    } else {
        dbgPanel.classList.add('hidden');
        dbgLeftPanel.classList.add('hidden');
        newGame();
    }
}

function startDebugLevel() {
    debugMode = true;
    runMode = 'debug-level';
    startRunSettings(false);
    document.getElementById('title-screen').classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    buildDebugPanel();
    document.getElementById('debug-panel').classList.remove('hidden');
    buildDebugLeftPanel();
    document.getElementById('debug-left-panel').classList.remove('hidden');
    initDebugLevel();
}

function newGame() {
    // A new run, including one after GAME OVER: a setting changed since the
    // last one applies from here.
    startRunSettings(!debugMode);
    score = 0;
    scoreEl.textContent = '000000';
    player = new Player(120, 445);
    // Per-game recharge counter — reset only when a brand new game starts.
    player.rechargeCountGame = 0;
    initStage(0);
}

function advanceStage() {
    const prevLives = player.lives;
    const prevHp    = Math.min(player.maxHp, player.hp + 80);
    initStage(currentStageIdx + 1);
    player.lives = prevLives;
    player.hp    = prevHp;
    player.x     = 120; player.y = 445; player.z = 0; player.vz = 0;
    player.invT  = 1.5;
    _hpHUD(player);
    livesEl.textContent = player.lives;
}

// togglePause - pause, opening the pause menu at RESUME, or resume. code is the
// key that asked (js/core/input.js passes P or Escape): Escape in one of the
// pause menu's own lists steps back out of it instead of resuming.
function togglePause(code = null) {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseOverlay.classList.remove('hidden');
        pauseMenu.show('main', 'pbtn-resume');
    } else if (gameState === 'paused') {
        if (code === 'Escape' && pauseMenu.back()) return;
        gameState = 'playing';
        pauseOverlay.classList.add('hidden');
        pendingLeave = null;
    }
}

function updateSceneCamera(dt) {
    const stageData = getCurrentStageData();
    const scene = stageData?.scene;
    if (levelMgr || !scene || scene.worldWidth <= W || !player) return;

    const maxCamX = Math.max(0, scene.worldWidth - W);
    const target = Math.max(0, Math.min(maxCamX,
        player.x + player.w * 0.5 - W * 0.5));
    cam.x += (target - cam.x) * Math.min(1, dt * 6);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
// update() mutates game state; draw() only reads and renders. Keeping them
// distinct makes pause (skip update, keep drawing) straightforward.
function update(dt) {
    updateCamera(dt);
    if (levelMgr) levelMgr.update(dt, player, enemies, breakables);
    player.update(dt, enemies, effects, pickups, breakables);
    if (levelRuntime) levelRuntime.update(dt, player);
    if (levelDirector) levelDirector.update(dt, player);
    updateSceneCamera(dt);
    enemies.forEach(e => e.update(dt, player, enemies));
    effects.forEach(f => f.update(dt));
    pickups.forEach(p => p.update(dt));
    breakables.forEach(o => o.update(dt));

    // Remove "done" entries each frame.
    enemies    = enemies.filter(e => !e.isDone);
    effects    = effects.filter(f => !f.done);
    pickups    = pickups.filter(p => !p.taken);
}

// gameLoop is called by requestAnimationFrame. 'ts' is a high-precision timestamp
// in milliseconds. Math.min caps dt at 50ms so a backgrounded tab can't cause a
// huge physics step that sends entities flying or tunnelling through walls.
function gameLoop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    try {
        if (gameState === 'title') {
            drawTitle();
        } else if (gameState === 'playing') {
            // An overlay (an item's message, later the item screen) stops
            // the game under it; only the overlay moves.
            if (typeof GameUI !== 'undefined' && GameUI.isOpen()) GameUI.update(dt);
            else update(dt);
            draw();
        } else if (gameState === 'paused') {
            draw();
        } else {
            draw(); // stageclear / gameover / victory
            if (JustPressed['Enter']) {
                if (gameState === 'stageclear' && !debugMode) {
                    advanceStage();
                } else if (debugMode) {
                    (debugRestart || initDebugArena)();
                } else {
                    newGame();
                }
            }
        }
    } catch (e) {
        console.error('[gameLoop]', e);
    }

    // clearJustPressed must run AFTER all game logic so JustPressed values are
    // visible to everything that needs them this frame, then wiped before next.
    clearJustPressed();
    requestAnimationFrame(gameLoop);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
// The 'load' event fires after the entire page (HTML, CSS, images) has loaded.
window.addEventListener('load', async () => {
    // Lay the saved configuration.json, enemies.json and objects.json over CFG
    // before anything runs (see CFG_FILES in js/core/config.js). A file that is
    // missing or not valid JSON is skipped and the built-in values stand.
    applyCfgFiles('config/');
    CFG_BOOT = Object.freeze({ ...CFG });

    // Wait until every SVG sprite has fully decoded. ASSETS_READY is defined in
    // js/sprites/ready.js and collects img.decode() promises from loadSvgFile.
    await ASSETS_READY;

    document.getElementById('loading-screen').style.display = 'none';

    initMenus();
    openFromAddress();
    pauseBtn.addEventListener('click', () => togglePause());
    requestAnimationFrame(gameLoop);
});

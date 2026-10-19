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
let lastTime = 0;

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

// ── Title screen menu ──────────────────────────────────────────────────
// The title buttons answer to the mouse and the keyboard at the same time:
// up/down (or W/S) move the highlight, Enter or Space starts the highlighted
// mode, and clicking or hovering a button still works exactly as before.
//
// The highlight is tracked here rather than through DOM focus on purpose. A
// focused <button> is activated by the browser on Enter as well, so driving the
// menu through focus would run the chosen mode twice on a single keypress.
const TITLE_ITEMS = [
    { id: 'btn-game',        start: () => startGame(false)  },
    { id: 'btn-debug',       start: () => startGame(true)   },
    { id: 'btn-debug-level', start: () => startDebugLevel() },
    { id: 'btn-sandbox',     start: () => startSandbox()    },
];
let titleIdx = 0;

function setTitleSelection(i) {
    titleIdx = (i + TITLE_ITEMS.length) % TITLE_ITEMS.length;
    TITLE_ITEMS.forEach((item, n) => {
        const btn = document.getElementById(item.id);
        if (btn) btn.classList.toggle('selected', n === titleIdx);
    });
}

function _onTitleKey(e) {
    if (gameState !== 'title') return;
    switch (e.code) {
        case 'ArrowUp':   case 'KeyW': setTitleSelection(titleIdx - 1); break;
        case 'ArrowDown': case 'KeyS': setTitleSelection(titleIdx + 1); break;
        case 'Enter': case 'NumpadEnter': case 'Space':
            TITLE_ITEMS[titleIdx].start();
            // The press that started the game must not also reach the first
            // frame of it, or the player jumps or swings on the way in.
            clearJustPressed();
            break;
        default: return;
    }
    e.preventDefault();
}

function initTitleMenu() {
    TITLE_ITEMS.forEach((item, n) => {
        const btn = document.getElementById(item.id);
        if (!btn) return;
        btn.addEventListener('click', item.start);
        // Hovering moves the highlight so the mouse and the keyboard never
        // disagree about which entry is the live one.
        btn.addEventListener('mouseenter', () => setTitleSelection(n));
    });
    setTitleSelection(0);
    window.addEventListener('keydown', _onTitleKey);
}

function startGame(isDebug) {
    debugMode = isDebug;
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
    document.getElementById('title-screen').classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    buildDebugPanel();
    document.getElementById('debug-panel').classList.remove('hidden');
    buildDebugLeftPanel();
    document.getElementById('debug-left-panel').classList.remove('hidden');
    initDebugLevel();
}

function newGame() {
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

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseOverlay.classList.remove('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pauseOverlay.classList.add('hidden');
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
            update(dt);
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

    // Wait until every SVG sprite has fully decoded. ASSETS_READY is defined in
    // js/sprites/ready.js and collects img.decode() promises from loadSvgFile.
    await ASSETS_READY;

    document.getElementById('loading-screen').style.display = 'none';

    initTitleMenu();
    pauseBtn.addEventListener('click', togglePause);
    requestAnimationFrame(gameLoop);
});

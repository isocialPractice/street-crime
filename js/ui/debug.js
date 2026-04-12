// js/ui/debug.js — Debug mode panel, sandbox arena, and configuration export

// ── Right panel (global / meta settings) ─────────────────────────────────────
function buildDebugPanel() {
    const panel = document.getElementById('debug-panel');
    const rows = [
        { section: 'GLOBAL' },
        { key:'scoreMultiplier', label:'Score ×',          min:0,   max:10,  step:0.1  },
        { key:'comboTimeout',    label:'Combo Timeout (s)', min:0.5, max:8,   step:0.1  },
        { section: 'ARENA' },
        { key:'groundMin',       label:'Ground Top (Y)',   min:200, max:480,  step:1    },
        { key:'groundMax',       label:'Ground Bot (Y)',   min:400, max:580,  step:1    },
        { section: 'HIT EFFECTS' },
        { key:'hitFlashAlpha',   label:'Hurt Flash Alpha', min:0,   max:1,    step:0.05 },
    ];

    let html = '<div id="dbg-title">DEBUG MODE</div>';
    html += `<label class="dbg-toggle"><input type="checkbox" id="dbg-inf-hp"${CFG.infiniteHealth ? ' checked' : ''}> Infinite Health</label>`;
    html += `<label class="dbg-toggle"><input type="checkbox" id="dbg-show-hb"${CFG.showHitboxes  ? ' checked' : ''}> Show Hitboxes</label>`;
    for (const r of rows) {
        if (r.section) { html += `<div class="dbg-section">${r.section}</div>`; continue; }
        const v = CFG[r.key];
        html += `<div class="dbg-row">
            <span class="dbg-label">${r.label}</span>
            <input type="range" class="dbg-slider" data-key="${r.key}"
                   min="${r.min}" max="${r.max}" step="${r.step}" value="${v}">
            <span class="dbg-val" id="dbg-v-${r.key}">${v}</span>
        </div>`;
    }
    html += '<button id="dbg-export">&#x2B07; Export All (configuration.json)</button>';
    panel.innerHTML = html;

    panel.querySelectorAll('.dbg-slider').forEach(input => {
        input.addEventListener('input', () => {
            const k = input.dataset.key;
            CFG[k] = Number(input.value);
            document.getElementById(`dbg-v-${k}`).textContent = CFG[k];
        });
    });
    document.getElementById('dbg-inf-hp').addEventListener('change', e => { CFG.infiniteHealth = e.target.checked; });
    document.getElementById('dbg-show-hb').addEventListener('change', e => { CFG.showHitboxes   = e.target.checked; });
    document.getElementById('dbg-export').addEventListener('click', exportConfig);
}

function exportConfig() {
    const out = Object.assign({}, CFG);
    delete out.infiniteHealth;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config/configuration.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Debug Focus: mode-specific slider definitions ─────────────────────────────
const _DEBUG_FOCUS_ROWS = {
    player: [
        { section: 'PLAYER MOVEMENT' },
        { key:'playerSpeed',          label:'Player Speed',       min:50,  max:600,  step:5    },
        { key:'jumpSpeed',            label:'Jump Speed',         min:100, max:1200, step:10   },
        { key:'gravity',              label:'Gravity',            min:100, max:2500, step:10   },
        { key:'playerAirControl',     label:'Air Control',        min:0.1, max:1.5,  step:0.05 },
        { section: 'PLAYER ANIMATION' },
        { key:'playerWalkFPS',        label:'Walk FPS',           min:1,   max:20,   step:1    },
        { key:'playerIdleFPS',        label:'Idle FPS',           min:1,   max:10,   step:1    },
        { key:'playerInvFlashRate',   label:'Inv Flash Rate',     min:1,   max:30,   step:1    },
        { section: 'ATTACK RANGES (px)' },
        { key:'punchRange',           label:'Punch Range',        min:10,  max:200,  step:1    },
        { key:'kickRange',            label:'Kick Range',         min:10,  max:200,  step:1    },
        { key:'uppercutRange',        label:'Uppercut Range',     min:10,  max:150,  step:1    },
        { key:'runningKickRange',     label:'Running Kick Range', min:20,  max:250,  step:1    },
        { key:'jumpKickRange',        label:'Jump Kick Range',    min:20,  max:200,  step:1    },
        { section: 'ATTACK DAMAGE' },
        { key:'punchDmg',             label:'Punch Damage',       min:1,   max:150,  step:1    },
        { key:'kickDmg',              label:'Kick Damage',        min:1,   max:150,  step:1    },
        { key:'uppercutDmg',          label:'Uppercut Damage',    min:1,   max:200,  step:1    },
        { key:'runningKickDmg',       label:'Running Kick Dmg',   min:1,   max:200,  step:1    },
        { key:'jumpKickDmg',          label:'Jump Kick Damage',   min:1,   max:200,  step:1    },
        { section: 'HIT DETECTION (px)' },
        { key:'collisionBodyOverlap', label:'Body Overlap',       min:0,   max:60,   step:1    },
        { key:'collisionDepthTol',    label:'Depth Tolerance',    min:5,   max:100,  step:1    },
        { section: 'HIT RESPONSE' },
        { key:'playerHurtInvTime',    label:'Hurt Inv Time',      min:0,   max:3,    step:0.05 },
        { key:'playerKnockdownTime',  label:'Knockdown Time',     min:0.3, max:5,    step:0.1  },
    ],
    enemy: [
        { section: 'ENEMY ANIMATION' },
        { key:'enemyWalkFPS',              label:'Walk FPS',           min:1,   max:20,  step:1    },
        { key:'enemyIdleFPS',              label:'Idle FPS',           min:1,   max:10,  step:1    },
        { key:'enemyAttackDuration',       label:'Attack Hold (s)',    min:0.1, max:4.0, step:0.05 },
        { key:'enemyAttackFrameHold',      label:'Frame Hold (s)',     min:0,   max:2.0, step:0.05 },
        { key:'enemyAttackFPS',            label:'Attack FPS',         min:1,   max:30,  step:1    },
        { key:'enemyHurtFlashFPS',         label:'Hurt Flash FPS',     min:1,   max:60,  step:1    },
        { section: 'ENEMY AI BEHAVIOR' },
        { key:'enemyCloseEnough',          label:'Attack Dist',        min:20,  max:200, step:1    },
        { key:'enemyAtkCheckDist',         label:'Hit Reach',          min:20,  max:200, step:1    },
        { key:'enemyAtkDepthTol',          label:'Hit Depth Tol',      min:5,   max:100, step:1    },
        { key:'enemyAtkCooldown',          label:'Atk Cooldown',       min:0.3, max:5,   step:0.1  },
        { key:'enemyFlankRadius',          label:'Flank Radius',       min:50,  max:400, step:5    },
        { key:'enemyFlankSpeed',           label:'Flank Speed',        min:0.1, max:1.0, step:0.05 },
        { section: 'ENEMY ENGAGEMENT' },
        { key:'enemyEngageDelayMin',       label:'Engage Delay Min',   min:0,   max:6,   step:0.1  },
        { key:'enemyEngageDelayMax',       label:'Engage Delay Range', min:0,   max:6,   step:0.1  },
        { key:'enemyReengageMin',          label:'Re-engage Min',      min:0,   max:5,   step:0.1  },
        { key:'enemyReengageRange',        label:'Re-engage Range',    min:0,   max:5,   step:0.1  },
        { key:'enemyGetupReengageMin',     label:'Getup Re-engage',    min:0,   max:4,   step:0.1  },
        { section: 'ENEMY ATTACK IMPACT' },
        { key:'enemyAtkHitDelay',          label:'Hit Delay (ms)',     min:0,   max:800, step:10   },
        { key:'enemyKnockbackDist',        label:'Knockback Dist',     min:0,   max:120, step:1    },
        { key:'enemyLaunchKnockbackDist',  label:'Launch Knockback',   min:0,   max:200, step:1    },
        { section: 'ENEMY MULTIPLIERS' },
        { key:'enemyDmgMultiplier',        label:'Damage ×',          min:0.1, max:5,   step:0.05 },
        { key:'enemySpeedMultiplier',      label:'Speed ×',           min:0.1, max:5,   step:0.05 },
        { key:'enemyHealthMultiplier',     label:'Health × (spawn)',  min:0.1, max:5,   step:0.05 },
        { section: 'ENEMY TIMING' },
        { key:'enemyKnockdownTime',        label:'Knockdown',          min:0.3, max:5,   step:0.1  },
        { key:'enemyGetupTime',            label:'Getup Time',         min:0.1, max:2,   step:0.05 },
        { section: 'DEFEAT SPRITE' },
        { key:'defeatScaleX',              label:'Scale X',            min:0.1, max:4,   step:0.05 },
        { key:'defeatScaleY',              label:'Scale Y',            min:0.1, max:4,   step:0.05 },
        { key:'defeatRotation',            label:'Rotation (deg)',     min:-180,max:180, step:1    },
        { key:'defeatOffsetX',             label:'Offset X',           min:-200,max:200, step:1    },
        { key:'defeatOffsetY',             label:'Offset Y',           min:-200,max:200, step:1    },
        { key:'defeatFadeDelay',           label:'Fade Delay (s)',     min:0,   max:10,  step:0.1  },
    ],
    object: [
        { section: 'BLOCKING COLLISION' },
        { key:'objBlockDepthExpand',  label:'Block Depth Expand', min:0,   max:40,  step:1    },
        { section: 'BREAK COLLISION (player hits object)' },
        { key:'objCollisionRange',    label:'Hit Range',          min:10,  max:200, step:1    },
        { key:'objCollisionOverlap',  label:'Body Overlap',       min:0,   max:60,  step:1    },
        { key:'objCollisionDepthTol', label:'Depth Tol',          min:5,   max:120, step:1    },
        { section: 'OBJECT PROPERTIES' },
        { key:'objBreakDropChance',   label:'Drop Chance',        min:0,   max:1,   step:0.05 },
        { section: 'PICKUP COLLECTION' },
        { key:'pickupRange',          label:'Pickup Range',       min:10,  max:150, step:1    },
        { key:'pickupDepthTol',       label:'Pickup Depth Tol',   min:10,  max:120, step:1    },
    ],
};

// ── Left panel ─────────────────────────────────────────────────────────────────
let _currentFocusMode = 'player';

function buildDebugLeftPanel() {
    const panel = document.getElementById('debug-left-panel');
    const enemyOptions = Object.keys(ENEMY_DEFS)
        .map(k => `<option value="${k}">${k}</option>`)
        .join('');

    panel.innerHTML = `
        <div id="dbg-title">DEBUG FOCUS</div>
        <select id="dbg-focus-select" class="dbg-focus-dropdown">
            <option value="player">&#9654; Player Mode</option>
            <option value="enemy">&#9654; Enemy Mode</option>
            <option value="object">&#9654; Object Mode</option>
        </select>
        <div id="dbg-focus-content"></div>

        <div class="dbg-section">SANDBOX</div>
        <div class="dbg-subsection">ENEMY</div>
        <select class="dbg-enemy-select" id="dbg-enemy-select">${enemyOptions}</select>
        <button class="dbg-spawn-btn" id="dbg-spawn-enemy">&#9654; SPAWN ENEMY</button>
        <div class="dbg-status" id="dbg-enemy-status">ready</div>

        <div class="dbg-subsection">OBJECT</div>
        <button class="dbg-spawn-btn" id="dbg-spawn-obj">&#9654; SPAWN OBJECT</button>
        <div class="dbg-status" id="dbg-obj-status">ready</div>
    `;

    _renderFocusContent(_currentFocusMode);

    document.getElementById('dbg-focus-select').addEventListener('change', e => {
        _currentFocusMode = e.target.value;
        _renderFocusContent(_currentFocusMode);
    });
    document.getElementById('dbg-spawn-enemy').addEventListener('click', () =>
        spawnDebugEnemy(document.getElementById('dbg-enemy-select').value));
    document.getElementById('dbg-spawn-obj').addEventListener('click', () => {
        spawnDebugObject();
        document.getElementById('dbg-obj-status').textContent = 'object spawned';
    });
}

function _renderFocusContent(mode) {
    const container = document.getElementById('dbg-focus-content');
    if (!container) return;
    const rows = _DEBUG_FOCUS_ROWS[mode] || [];
    let html = '';
    for (const r of rows) {
        if (r.section) { html += `<div class="dbg-section">${r.section}</div>`; continue; }
        const v = CFG[r.key];
        html += `<div class="dbg-row">
            <span class="dbg-label">${r.label}</span>
            <input type="range" class="dbg-slider dbg-focus-slider" data-key="${r.key}"
                   min="${r.min}" max="${r.max}" step="${r.step}" value="${v}">
            <span class="dbg-val" id="dbg-v-${r.key}">${v}</span>
        </div>`;
    }
    const exportLabels = {
        player: '&#x2B07; Export configuration.json',
        enemy:  '&#x2B07; Export enemies.json',
        object: '&#x2B07; Export objects.json',
    };
    html += `<button class="dbg-focus-export" data-mode="${mode}">${exportLabels[mode]}</button>`;
    container.innerHTML = html;

    container.querySelectorAll('.dbg-focus-slider').forEach(input => {
        input.addEventListener('input', () => {
            const k = input.dataset.key;
            CFG[k] = Number(input.value);
            const valEl = document.getElementById(`dbg-v-${k}`);
            if (valEl) valEl.textContent = CFG[k];
        });
    });
    container.querySelector('.dbg-focus-export').addEventListener('click', () => {
        if      (mode === 'player') exportConfig();
        else if (mode === 'enemy')  exportEnemies();
        else if (mode === 'object') exportObjects();
    });
}

function exportEnemies() {
    const ENEMY_KEYS = [
        'enemyWalkFPS','enemyIdleFPS','enemyAttackDuration','enemyAttackFrameHold',
        'enemyAttackFPS','enemyHurtFlashFPS','enemyCloseEnough','enemyAtkCheckDist',
        'enemyAtkDepthTol','enemyAtkCooldown','enemyFlankRadius','enemyFlankSpeed',
        'enemyEngageDelayMin','enemyEngageDelayMax','enemyReengageMin','enemyReengageRange',
        'enemyGetupReengageMin','enemyAtkHitDelay','enemyKnockbackDist',
        'enemyLaunchKnockbackDist','enemyDmgMultiplier','enemySpeedMultiplier',
        'enemyHealthMultiplier','enemyKnockdownTime','enemyGetupTime',
        'defeatScaleX','defeatScaleY','defeatRotation','defeatOffsetX','defeatOffsetY','defeatFadeDelay',
    ];
    const out = {};
    for (const k of ENEMY_KEYS) if (k in CFG) out[k] = CFG[k];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config/enemies.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportObjects() {
    const OBJ_KEYS = [
        'objBlockDepthExpand','objCollisionRange','objCollisionOverlap','objCollisionDepthTol',
        'objBreakDropChance','pickupRange','pickupDepthTol',
    ];
    const out = {};
    for (const k of OBJ_KEYS) if (k in CFG) out[k] = CFG[k];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config/objects.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Arena / spawn helpers ──────────────────────────────────────────────────────
function initDebugArena() {
    score = 0;
    scoreEl.textContent = '000000';
    currentStageIdx = 0;
    stageEl.textContent = 'DBG';
    cam.x = 0; cam.power = 0;
    enemies    = [];
    effects    = [];
    breakables = [];
    pickups    = [];
    levelMgr   = null;
    player = new Player(180, 450);
    hideOverlay();
    _hideBossHUD();
    _updateComboHUD(0);
    _hpHUD(player);
    livesEl.textContent = player.lives;
    gameState = 'playing';
}

function spawnDebugEnemy(typeId) {
    enemies = []; effects = [];
    enemies.push(new Enemy(player.x + 280, player.y, typeId));
    _updateDebugStatus();
}

function spawnDebugObject() {
    breakables = []; pickups = [];
    breakables.push(new BreakableObj(player.x + 160, 490));
}

function _updateDebugStatus() {
    const el = document.getElementById('dbg-enemy-status');
    if (!el) return;
    if (enemies.length === 0) { el.textContent = 'defeated — spawn next'; return; }
    const e = enemies[0];
    el.textContent = `${e.typeId}  [${e.state}]  ${e.hp}/${e.maxHp} hp`;
}

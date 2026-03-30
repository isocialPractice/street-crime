// game.js — Street Crime: Beat 'Em Up
// Note 1: This is the entire game engine in one file. It covers input, physics,
// entity logic, AI, collision detection, level management, HUD, and the render loop.
// Read top-to-bottom: later sections depend on constants and classes defined earlier.

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS + UI REFS
// ─────────────────────────────────────────────────────────────────────────────
// Note 2: We grab the canvas element once at startup and reuse it everywhere.
// getContext('2d') returns the CanvasRenderingContext2D — the drawing API we call
// every frame. Storing W and H avoids repeated property lookups inside the loop.
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Note 3: These are DOM references to the HUD elements defined in index.html.
// We update them by writing to .textContent, .style.width, or classList — the
// browser reflects changes in the UI without any framework needed.
const scoreEl      = document.getElementById('score');
const livesEl      = document.getElementById('lives');
const healthFill   = document.getElementById('health-fill');
const stageEl      = document.getElementById('stage');
const comboDisplay = document.getElementById('combo-display');
const comboEl      = document.getElementById('combo');
const bossHud      = document.getElementById('boss-hud');
const bossNameEl   = document.getElementById('boss-name');
const bossFill     = document.getElementById('boss-health-fill');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');
const pauseBtn     = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// Note 4: This game uses a 2.5D coordinate system, common in classic beat-em-ups.
// X is the horizontal world axis (increases right, scrolls with the camera).
// Y is the DEPTH axis — it represents how far "into" the screen a character stands.
//   GROUND_MIN (390) = back of scene (top of screen visually)
//   GROUND_MAX (510) = front of scene (bottom of screen visually)
// Z is the JUMP axis — how high a character is above the ground plane.
//   z=0 means on the ground; positive z lifts the sprite upward on screen.
// The sprite's visual top is drawn at (y - z); the sprite's feet land at (y + h).
const GROUND_MIN = 390;   // top of walkable zone (world Y)
const GROUND_MAX = 510;   // bottom of walkable zone

// CFG holds every tunable game value. Debug mode exposes these via sliders and
// exports them to configuration.json. Read CFG in game logic — never hardcode these.
const CFG = {
    // ── Attack ranges (pixels) ──────────────────────────────────────────────
    punchRange:              54,
    kickRange:               66,
    uppercutRange:           46,
    runningKickRange:        86,
    jumpKickRange:           72,
    // ── Attack damage ───────────────────────────────────────────────────────
    punchDmg:                22,
    kickDmg:                 27,
    uppercutDmg:             40,
    runningKickDmg:          35,
    jumpKickDmg:             30,
    // ── Movement ────────────────────────────────────────────────────────────
    playerSpeed:            220,
    jumpSpeed:              500,
    gravity:                900,
    // ── Animation speeds (frames per second) ────────────────────────────────
    playerWalkFPS:            5,
    playerIdleFPS:            2,
    enemyWalkFPS:             7,
    // ── Player hit detection ─────────────────────────────────────────────────
    collisionBodyOverlap:     6,
    collisionDepthTol:       28,
    // ── Object collision (player breaking crates) ────────────────────────────
    objCollisionRange:       72,   // horizontal reach when attacking an object
    objCollisionOverlap:     15,   // body overlap on the near side
    objCollisionDepthTol:    55,   // feet-to-bottom depth tolerance
    // ── Pickup collection ────────────────────────────────────────────────────
    pickupRange:             55,   // horizontal grab radius
    pickupDepthTol:          60,   // feet-to-pickup depth tolerance
    // ── Enemy AI ────────────────────────────────────────────────────────────
    enemyCloseEnough:        72,
    enemyAtkCheckDist:       95,
    enemyAtkDepthTol:        35,
    enemyAtkCooldown:       2.2,
    // ── Enemy attack ────────────────────────────────────────────────────────
    enemyAtkHitDelay:       270,   // ms before enemy hit lands (matches mid-swing)
    enemyKnockbackDist:      18,   // px pushed on normal hurt
    enemyLaunchKnockbackDist:70,   // px pushed on launch hit
    // ── Hit response timings ─────────────────────────────────────────────────
    playerHurtInvTime:     0.55,   // s player is invincible after a hit
    playerKnockdownTime:    1.5,   // s player lies down before rising
    enemyKnockdownTime:     1.5,   // s enemy lies down before rising
    enemyGetupTime:        0.55,   // s enemy getup animation
    // ── Defeat sprite display ─────────────────────────────────────────────────
    defeatScaleX:           1.0,   // uniform/non-uniform X scale of defeat sprite
    defeatScaleY:           1.0,   // Y scale of defeat sprite
    defeatRotation:           0,   // degrees — added on top of facing
    defeatOffsetX:            0,   // px horizontal nudge
    defeatOffsetY:            0,   // px vertical nudge (positive = down)
    defeatFadeDelay:        1.8,   // s before corpse is removed from scene
    // ── Hit effects ───────────────────────────────────────────────────────────
    hitFlashAlpha:         0.45,   // enemy flash opacity when hurt
    // ── Combo ─────────────────────────────────────────────────────────────────
    comboTimeout:           2.5,   // s before combo counter resets
    // ── Enemy global multipliers ─────────────────────────────────────────────
    enemyDmgMultiplier:      1.0,   // scales all enemy hit damage to player
    enemySpeedMultiplier:    1.0,   // scales all enemy movement speeds
    enemyHealthMultiplier:   1.0,   // scales all enemy max HP at spawn
    // ── Enemy engagement timing ──────────────────────────────────────────────
    enemyEngageDelayMin:     1.5,   // s min before an enemy starts rushing
    enemyEngageDelayMax:     2.0,   // s random range added on top of min
    enemyReengageMin:        1.3,   // s min before enemy re-enters queue after attacking
    enemyReengageRange:      1.4,   // s random range added on top of re-engage min
    enemyGetupReengageMin:   0.8,   // s min re-engage after getting up from knockdown
    // ── Enemy animation ──────────────────────────────────────────────────────
    enemyAttackDuration:      0.9,   // s enemy holds the attack state before returning to idle
    enemyAttackFrameHold:    0.50,   // s the attack sprite is held before alternating to attack2 (affects all enemies)
    enemyAttackFPS:            2,   // attack frame alternation speed (attack ↔ attack2)
    enemyHurtFlashFPS:        20,   // hurt flash toggle frequency
    // ── Score ────────────────────────────────────────────────────────────────
    scoreMultiplier:         1.0,   // multiply all score gains
    // ── Arena (debug) ────────────────────────────────────────────────────────
    groundMin:             390,   // top of walkable zone (world Y) — back of scene
    groundMax:             510,   // bottom of walkable zone — front of scene
    // ── Debug flags ─────────────────────────────────────────────────────────
    infiniteHealth:        false,
    showHitboxes:           true,   // draw hitboxes in debug mode
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER SCALES  (loaded from characters.json at boot, tuned in Sprite Viewer)
// ─────────────────────────────────────────────────────────────────────────────
// charScales['__player__']['walk'] = { sx: 1.0, sy: 1.0 }
// charScales['CrimeGuy']['defeat'] = { sx: 1.2, sy: 1.2 }
// Keys match stateKeys defined in _playerStateKey / _enemyStateKey.
const charScales = {};

// Return scale for a character+state, defaulting to 1.0.
function _charScale(charKey, stateKey) {
    const s = charScales[charKey]?.[stateKey];
    return { sx: s?.sx ?? 1.0, sy: s?.sy ?? 1.0 };
}

function _setCharScale(charKey, stateKey, sx, sy) {
    if (!charScales[charKey]) charScales[charKey] = {};
    charScales[charKey][stateKey] = { sx, sy };
}

// Map player.state → charScales stateKey.
function _playerStateKey(state) {
    switch (state) {
        case 'walk':                          return 'walk';
        case 'run':                           return 'run';
        case 'jump':                          return 'jump';
        case 'jumpkick':                      return 'jumpkick';
        case 'punch1':                        return 'punch1';
        case 'punch2':                        return 'punch2';
        case 'kick1':                         return 'kick1';
        case 'kick2':                         return 'kick2';
        case 'uppercut':                      return 'uppercut';
        case 'runningkick':                   return 'runningkick';
        case 'hurt': case 'knockdown':
        case 'knockedUp':                     return 'knockdown';
        default:                              return 'idle';
    }
}

// Map enemy.state → charScales stateKey.
function _enemyStateKey(state) {
    switch (state) {
        case 'walk':   return 'walk';
        case 'attack': return 'attack';
        case 'dead':   return 'defeat';
        default:       return 'idle';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────
// Note 6: Two dictionaries handle keyboard state.
//   Keys        — true while a key is held down (use for movement, held attacks).
//   JustPressed — true only on the FIRST frame a key is pressed (use for one-shot actions
//                 like jumping or attacking so tapping once fires exactly one action).
// Keys are identified by e.code (physical key, layout-independent: 'KeyA', 'Space', etc.).
const Keys = {};
const JustPressed = {};
window.addEventListener('keydown', e => {
    // Note 7: The !Keys[e.code] guard prevents JustPressed from being re-set every frame
    // while the key is held — the OS fires repeated keydown events during a hold.
    if (!Keys[e.code]) JustPressed[e.code] = true;
    Keys[e.code] = true;
    // Note 8: preventDefault stops the browser from scrolling the page when arrow keys or
    // Space are pressed. Without this the page would jerk during gameplay.
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault();
    if ((e.code === 'KeyP' || e.code === 'Escape') &&
        (gameState === 'playing' || gameState === 'paused'))
        togglePause();
});
window.addEventListener('keyup', e => { Keys[e.code] = false; });
// Note 9: clearJustPressed is called at the END of each game loop iteration so that
// each "just pressed" signal lasts for exactly one frame, then disappears.
function clearJustPressed() { for (const k in JustPressed) delete JustPressed[k]; }

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────────────────────────────────────────
// Note 10: The camera is a plain object (not a class). cam.x is the world X offset —
// every entity subtracts cam.x from its world X to get its screen X position.
// cam.shakeX/Y are random per-frame offsets applied via ctx.translate() in draw(),
// so the whole scene vibrates together without needing per-entity shake logic.
const cam = { x: 0, shakeX: 0, shakeY: 0, power: 0 };

// Note 11: Math.max keeps the strongest recent shake — if two hits land the same frame,
// we don't lose the bigger one. The shake decays by 25 units per second.
function screenShake(power) { cam.power = Math.max(cam.power, power); }

function updateCamera(dt) {
    if (cam.power > 0) {
        // Note 12: (Math.random() - 0.5) produces a value in [-0.5, 0.5]. Multiplying by
        // cam.power * 2 scales the shake radius. Each frame gets an independent random
        // offset, giving the jittery "camera shake" effect without any smoothing.
        cam.shakeX = (Math.random() - .5) * cam.power * 2;
        cam.shakeY = (Math.random() - .5) * cam.power * 2;
        cam.power = Math.max(0, cam.power - 25 * dt);
    } else { cam.shakeX = cam.shakeY = 0; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE / STATE
// ─────────────────────────────────────────────────────────────────────────────
// Note 13: gameState is a simple string-based finite state machine for the top-level
// game flow. The game loop checks it each frame to decide whether to call update() or
// only draw() and listen for Enter. Adding a new state (e.g. 'pause') means checking
// for it in gameLoop and implementing the desired behavior there.
let score = 0;
let gameState = 'title'; // 'title' | 'playing' | 'paused' | 'stageclear' | 'gameover' | 'victory'
let currentStageIdx = 0;
let debugMode = false;

// Note 14: padStart(6, '0') pads the score to always show 6 digits (e.g. "000120"),
// replicating the classic arcade score display style.
function addScore(n) {
    score += Math.round(n * CFG.scoreMultiplier);
    scoreEl.textContent = String(score).padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY BASE
// ─────────────────────────────────────────────────────────────────────────────
// Note 15: Entity is a base class — it holds the properties and methods shared by
// both Player and Enemy. Neither should be instantiated directly; use 'new Player()'
// or 'new Enemy()' instead. JavaScript uses 'extends' for inheritance (see below).
class Entity {
    constructor(x, y, w, h) {
        // Note 16: x/y are world-space coordinates. x scrolls with the level;
        // y is the depth lane (see Note 4). w/h are sprite dimensions in pixels.
        this.x = x;  this.y = y;
        this.z  = 0; this.vz = 0;   // z = jump height; vz = vertical velocity
        this.vx = 0; this.vy = 0;
        this.w = w;  this.h = h;
        this.hp = 100; this.maxHp = 100;
        // Note 17: facing is 1 (right) or -1 (left). It is used to flip the sprite
        // horizontally with ctx.scale(this.facing, 1) at draw time, and to direct
        // attack hitboxes and knockback in the correct direction.
        this.facing = 1;
        this.state = 'idle';
        this.stTimer = 0;  // state countdown
        this.animT  = 0;   // time inside current state (for animation)
        this.dead   = false;
    }

    // Note 18: JavaScript 'get' defines a computed property. screenX and drawY look
    // like plain fields from outside, but recalculate every time they are read.
    // screenX converts world X to screen X by subtracting the camera offset.
    // drawY lifts the sprite upward by z when the entity is airborne.
    get screenX() { return this.x - cam.x; }
    get drawY()   { return this.y - this.z; }          // visual Y (shake applied at draw() level)
    get grounded(){ return this.z <= 0 && this.vz <= 0; }

    // Note 19: stepState advances the animation timer and fires _onStateEnd when a timed
    // state expires. All state durations are in seconds; stTimer counts down each frame
    // using delta time (dt) so the timing is frame-rate independent.
    stepState(dt) {
        this.animT += dt;
        if (this.stTimer > 0) {
            this.stTimer -= dt;
            if (this.stTimer <= 0) { this.stTimer = 0; this._onStateEnd(); }
        }
    }

    // Note 20: setState resets animT to 0 so sprite animation always starts from the
    // beginning of the new state. dur=0 means the state has no timer and persists until
    // code explicitly changes it (e.g. 'idle', 'walk'). dur>0 means it auto-expires.
    setState(s, dur = 0) {
        this.state = s; this.stTimer = dur; this.animT = 0;
    }

    _onStateEnd() { this.setState('idle'); }  // default: timed states return to idle

    // Note 21: applyGravity uses Euler integration: velocity changes by acceleration*dt
    // each frame, and position changes by velocity*dt. This is an approximation — it is
    // slightly inaccurate at large dt values, which is why gameLoop caps dt at 0.05s.
    applyGravity(dt) {
        if (!this.grounded || this.vz > 0) {
            this.vz -= CFG.gravity * dt;
            this.z  += this.vz  * dt;
            // Note 22: When z reaches 0 (ground level), we clamp it and call _onLand()
            // so subclasses can react (e.g. transitioning from 'knockedUp' to 'knockdown').
            if (this.z <= 0) { this.z = 0; this.vz = 0; this._onLand(); }
        }
    }

    _onLand() {}

    // Note 23: moveXY applies planar (X/Y) velocity and clamps Y to the walkable zone.
    // Depth movement is limited to GROUND_MIN..GROUND_MAX; the player cannot walk
    // "behind" the scenery or "in front of" the camera.
    moveXY(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.y  = Math.max(CFG.groundMin, Math.min(CFG.groundMax, this.y));
    }

    // Note 24: The shadow is always drawn at y + h (the feet/ground contact point),
    // regardless of z. This keeps it pinned to the ground while the sprite rises during
    // a jump. The alpha decreases as z increases, making the shadow fainter when airborne.
    drawShadow() {
        const a = Math.max(0.05, 0.35 - this.z * 0.0005);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        // Note 25: ctx.ellipse draws an oval. The center is at the foot of the sprite.
        // ctx.save/restore bracket any ctx state changes (globalAlpha, fillStyle) so they
        // do not bleed into subsequent draw calls. This is a critical Canvas 2D pattern.
        ctx.ellipse(this.screenX + this.w / 2, this.y + this.h - 6,
                    this.w * 0.32, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER
// ─────────────────────────────────────────────────────────────────────────────
// Note 26: 'extends Entity' sets up the inheritance chain. Player inherits all
// Entity properties and methods and can override them or add new ones.
class Player extends Entity {
    constructor(x, y) {
        // Note 27: 'super()' must be called first in a subclass constructor.
        // It runs Entity's constructor, setting up x, y, w=60, h=100 and all base fields.
        super(x, y, 60, 100);
        this.hp = 300; this.maxHp = 300;
        this.lives = 3;
        this.speed = CFG.playerSpeed;
        this.atkCD  = 0;        // attack cooldown
        this.pPhase = 0;        // punch phase alternator
        this.kPhase = 0;        // kick phase alternator
        this.comboC = 0;        // combo count
        this.comboT = 0;        // combo timer
        this.invT   = 0;        // invincibility timer
        this.isRun  = false;
        this.downT  = 0;        // knockdown timer
    }

    // Note 28: 'busy' is true whenever the player is locked into an animation that
    // should prevent new actions or restrict movement. Array.includes() is a clean
    // alternative to a long chain of === comparisons. If you add a new attack state,
    // add its name here so it correctly blocks conflicting inputs.
    get busy() {
        return ['punch1','punch2','kick1','kick2','uppercut','runningkick','jumpkick',
                'hurt','knockdown','knockedUp'].includes(this.state);
    }

    update(dt, enemies, effects, pickups, breakables) {
        this.stepState(dt);
        this.applyGravity(dt);
        if (this.atkCD > 0) this.atkCD -= dt;
        if (this.invT  > 0) this.invT  -= dt;
        if (this.comboT > 0) {
            this.comboT -= dt;
            if (this.comboT <= 0) { this.comboC = 0; _updateComboHUD(0); }
        }

        // Knockdown — wait then stand up
        if (this.state === 'knockdown') {
            this.downT -= dt;
            if (this.downT <= 0) { this.setState('idle'); this.invT = 1.0; }
            return;
        }

        const canMove = !this.busy || this.state === 'jump' || this.state === 'jumpkick';
        const canAct  = !this.busy;

        // ── Movement ──────────────────────────────────────────────────────────
        if (canMove) {
            const left  = Keys['ArrowLeft']  || Keys['KeyA'];
            const right = Keys['ArrowRight'] || Keys['KeyD'];
            const up    = Keys['ArrowUp']    || Keys['KeyW'];
            const down  = Keys['ArrowDown']  || Keys['KeyS'];

            if (this.grounded) {
                const run = Keys['ShiftLeft'] || Keys['ShiftRight'];
                this.vx = 0; this.vy = 0;
                if (left)  { this.vx = -CFG.playerSpeed; this.facing = -1; }
                if (right) { this.vx =  CFG.playerSpeed; this.facing =  1; }
                if (up)    this.vy = -CFG.playerSpeed * 0.6;
                if (down)  this.vy =  CFG.playerSpeed * 0.6;

                if (this.vx !== 0 || this.vy !== 0) {
                    this.isRun = run;
                    const ws = this.isRun ? 'run' : 'walk';
                    if (this.state !== ws) this.setState(ws);
                } else {
                    this.isRun = false;
                    if (this.state !== 'idle') this.setState('idle');
                }
            } else {
                // Air strafe (horizontal only, slightly reduced)
                if (left)  { this.vx = -CFG.playerSpeed * 0.75; this.facing = -1; }
                if (right) { this.vx =  CFG.playerSpeed * 0.75; this.facing =  1; }
                else if (!left) this.vx = this.vx * 0.92; // light air friction
            }

            this.moveXY(dt);
            this.x = Math.max(cam.x, this.x);
            // During locked-camera phases (waves/boss arenas) also enforce a right boundary
            // so the player cannot walk off the right edge and get stuck off-screen.
            if (levelMgr?.locked) {
                this.x = Math.min(cam.x + W - this.w, this.x);
            }
        }

        // ── Jump ──────────────────────────────────────────────────────────────
        // Note 29: JustPressed ensures the jump fires once per keypress, not every frame
        // while Space is held. vz=500 sets the initial upward velocity; applyGravity()
        // in Entity decelerates it each frame until z returns to 0.
        if (JustPressed['Space'] && this.grounded && canAct) {
            this.vz = CFG.jumpSpeed;
            this.setState('jump');
        }

        // ── Attacks ───────────────────────────────────────────────────────────
        // Note 30: Attack inputs accept two keys each (J or Z for punch, K or X for kick)
        // so the game works on different keyboard layouts. Both map to the same action.
        const jPressed = JustPressed['KeyJ'] || JustPressed['KeyZ'];
        const kPressed = JustPressed['KeyK'] || JustPressed['KeyX'];
        const upHeld   = Keys['ArrowUp'] || Keys['KeyW'];

        if (canAct && this.atkCD <= 0) {
            if (!this.grounded) {
                // Air attack
                if (jPressed || kPressed) {
                    this.setState('jumpkick', 0.35);
                    this.atkCD = 0.4;
                    this._doAttack(enemies, effects, 'jumpkick');
                }
            } else if (jPressed && upHeld) {
                // Uppercut
                this.setState('uppercut', 0.45);
                this.atkCD = 0.55;
                this._doAttack(enemies, effects, 'uppercut');
            } else if (kPressed && this.isRun) {
                // Running kick
                this.setState('runningkick', 0.45);
                this.atkCD = 0.5;
                this._doAttack(enemies, effects, 'runningkick');
            } else if (jPressed) {
                // Note 31: The XOR trick (^= 1) toggles pPhase between 0 and 1 each press,
                // alternating between punch1 and punch2 sprites for a two-hit combo feel.
                const ph = this.pPhase; this.pPhase ^= 1;
                this.setState(ph === 0 ? 'punch1' : 'punch2', 0.28);
                this.atkCD = 0.32;
                this._doAttack(enemies, effects, 'punch');
            } else if (kPressed) {
                const ph = this.kPhase; this.kPhase ^= 1;
                this.setState(ph === 0 ? 'kick1' : 'kick2', 0.32);
                this.atkCD = 0.38;
                this._doAttack(enemies, effects, 'kick');
            }
        }

        // Break objects
        if (this.busy && !['hurt','knockdown','knockedUp'].includes(this.state)) {
            const bfront = (this.facing === 1) ? this.x + this.w : this.x;
            const bhx1   = (this.facing === 1) ? bfront - CFG.objCollisionOverlap : bfront - CFG.objCollisionRange;
            const bhx2   = (this.facing === 1) ? bfront + CFG.objCollisionRange   : bfront + CFG.objCollisionOverlap;
            breakables.forEach(obj => {
                // Compare player feet (this.y + this.h) to box bottom (obj.y) — both ground contacts.
                if (!obj.broken
                    && bhx2 > obj.x && bhx1 < obj.x + obj.w
                    && Math.abs((this.y + this.h) - obj.y) < CFG.objCollisionDepthTol) {
                    obj.smash(effects, pickups);
                }
            });
        }

        // Collect pickups
        const px = this.x + this.w / 2;
        pickups.forEach(p => {
            if (!p.taken
                && Math.abs(p.x - px) < CFG.pickupRange
                && Math.abs(p.y - (this.y + this.h)) < CFG.pickupDepthTol) {
                p.taken = true;
                this.hp = Math.min(this.maxHp, this.hp + 70);
                _hpHUD(this);
            }
        });

        _hpHUD(this);
        livesEl.textContent = this.lives;
    }

    // Note 32: _doAttack is the heart of hit detection. It is called immediately when an
    // attack begins (not at the end of the animation), so hits feel responsive.
    // All attack parameters are looked up by 'type' from local tables, keeping the logic
    // data-driven: to add a new move, add entries to RANGE, DMG, LAUNCH, and FX.
    _doAttack(enemies, effects, type) {
        const RANGE  = { punch:CFG.punchRange, kick:CFG.kickRange, uppercut:CFG.uppercutRange, runningkick:CFG.runningKickRange, jumpkick:CFG.jumpKickRange };
        const DMG    = { punch:CFG.punchDmg,   kick:CFG.kickDmg,   uppercut:CFG.uppercutDmg,   runningkick:CFG.runningKickDmg,   jumpkick:CFG.jumpKickDmg   };
        const LAUNCH = { uppercut: 450, runningkick:0, jumpkick:0, punch:0, kick:0 };
        const FX     = { punch:'small', kick:'medium', uppercut:'hard', runningkick:'medium', jumpkick:'medium' };

        const range  = RANGE[type]  || 70;
        const dmg    = DMG[type]    || 22;
        const launch = LAUNCH[type] || 0;
        const fxType = FX[type]     || 'small';
        let   hit    = false;

        const BODY_OVERLAP = CFG.collisionBodyOverlap;
        const DEPTH_TOL    = CFG.collisionDepthTol;
        const front = (this.facing === 1) ? this.x + this.w : this.x;
        const hx1   = (this.facing === 1) ? front - BODY_OVERLAP : front - range;
        const hx2   = (this.facing === 1) ? front + range        : front + BODY_OVERLAP;

        enemies.forEach(e => {
            if (e.dead || e.hp <= 0 || e.invincible) return;
            // Note 35: xHit checks horizontal overlap between the hitbox and the enemy AABB.
            // yHit compares feet-to-feet depth (y + h) so characters of different heights
            // are compared at the correct ground-contact point, not their sprite tops.
            const xHit = hx2 > e.x && hx1 < e.x + e.w;
            const yHit = Math.abs((e.y + e.h) - (this.y + this.h)) < DEPTH_TOL;
            if (xHit && yHit) {
                e.takeDamage(dmg, this.facing, launch);
                addScore(dmg * 5);
                hit = true;

                // Spawn effect at enemy mid
                effects.push(new HitFX(
                    e.x + e.w / 2,
                    e.y - e.h * 0.45 - e.z,
                    fxType
                ));

                // Combo
                this.comboC++;
                this.comboT = CFG.comboTimeout;
                _updateComboHUD(this.comboC);

                screenShake(type === 'uppercut' || type === 'runningkick' ? 7 : 3);
            }
        });
    }

    // Note 36: Player.takeDamage gates on invT (invincibility timer). Positive invT means
    // the player recently took a hit and is temporarily immune, preventing rapid successive
    // hits from being unfair. invT is set here (0.55s brief stun) and also set much longer
    // after a full knockdown (1.5s) to give the player time to recover.
    takeDamage(amount, dir, launch = 0) {
        if (this.invT > 0 || this.dead) return;
        if (debugMode && CFG.infiniteHealth) return;
        this.hp -= amount;
        screenShake(5);
        effects.push(new HitFX(this.x + this.w / 2, this.y - this.h * 0.4, 'medium'));
        if (this.hp <= 0) { this.hp = 0; this._die(); return; }
        if (launch > 0) {
            this.vz = launch * 0.7;
            this.x += dir * 50;
            this.setState('knockedUp'); // no timer — _onLand handles transition
        } else {
            this.setState('hurt', 0.35);
            this.invT = CFG.playerHurtInvTime;
        }
        _hpHUD(this);
    }

    _onLand() {
        if (this.state === 'knockedUp') {
            this.setState('knockdown');
            this.downT = CFG.playerKnockdownTime;
            this.invT  = CFG.playerKnockdownTime;
        } else if (this.state === 'jump' || this.state === 'jumpkick') {
            this.setState('idle');
        }
    }

    _die() {
        this.lives--;
        livesEl.textContent = this.lives;
        if (this.lives <= 0) {
            this.dead = true;
            gameState = 'gameover';
            showOverlay('GAME OVER', `Score: ${score}`);
        } else {
            this.hp = this.maxHp;
            this.x  = cam.x + 90;
            this.y  = 445;
            this.z  = this.vz = 0;
            this.setState('idle');
            this.invT = 2.5;
            _hpHUD(this);
        }
    }

    getImg() {
        const WALK_FRAMES = [PLAYER.walk0,PLAYER.walk1,PLAYER.walk2,PLAYER.walk3,PLAYER.walk4,PLAYER.walk5,PLAYER.walk6,PLAYER.walk7];
        const IDLE_FRAMES = [PLAYER.idle1,PLAYER.idle2,PLAYER.idle3,PLAYER.idle4];
        switch (this.state) {
            case 'walk':        return WALK_FRAMES[Math.floor(this.animT * CFG.playerWalkFPS) % 8];
            case 'run':         return PLAYER.run;
            case 'jump':        return PLAYER.jump;
            case 'jumpkick':    return PLAYER.jumpKick;
            case 'punch1':      return PLAYER.punch1;
            case 'punch2':      return PLAYER.punch2;
            case 'kick1':       return PLAYER.kick1;
            case 'kick2':       return PLAYER.kick2;
            case 'uppercut':    return PLAYER.upperCut;
            case 'runningkick': return PLAYER.runningKick;
            case 'hurt':
            case 'knockdown':
            case 'knockedUp':   return PLAYER.knockDown;
            default:            return IDLE_FRAMES[Math.floor(this.animT * CFG.playerIdleFPS) % 4];
        }
    }

    draw() {
        if (this.invT > 0 && Math.floor(this.invT * 12) % 2 === 0) return;
        this.drawShadow();
        const img = this.getImg();
        const dw = img.naturalWidth  || this.w;
        const dh = img.naturalHeight || this.h;
        const sc = _charScale('__player__', _playerStateKey(this.state));
        ctx.save();
        ctx.translate(this.screenX + this.w / 2, this.drawY + this.h);
        ctx.scale(this.facing * sc.sx, sc.sy);
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
// Note 39: ENEMY_DEFS is a lookup table keyed by the typeId string used in STAGES.
// Each entry is a plain data object — no methods. The Enemy class reads from it
// in its constructor (this.def = ENEMY_DEFS[typeId]) and references it throughout.
// To add a new enemy type: add an entry here, create the SVG in assets/, add the
// matching entry to ENEMY_CHARS in assets.js, and place it in a STAGES wave.
// Fields:  img=sprite key, hp=health, spd=speed, dmg=attack damage,
//          pts=score on kill, w/h=hitbox size, boss/mini=HUD bar flags.
const ENEMY_DEFS = {
    // ── Stage 1 ──────────────────────────────────────────────────────────────
    crimeguy:      { img:'CrimeGuy',            hp: 50,  spd: 85,  dmg: 8,  pts:100, w:55, h:95  },
    badgirl:       { img:'BadGirl',             hp: 45,  spd: 95,  dmg: 7,  pts:100, w:50, h:90  },
    sassygirl:     { img:'SassyGirl',           hp: 45,  spd:100,  dmg: 7,  pts:100, w:50, h:90  },
    badone:        { img:'BadOne',              hp: 55,  spd: 80,  dmg: 9,  pts:120, w:60, h:100 },
    tightromper:   { img:'TightRomper',         hp: 60,  spd: 75,  dmg:10,  pts:130, w:60, h:100 },
    jammingjabber: { img:'JammingJabber',       hp: 60,  spd: 88,  dmg:10,  pts:130, w:55, h:95  },
    jumpingjunkie: { img:'JumpingJunkie',       hp: 55,  spd:108,  dmg: 9,  pts:125, w:50, h:95  },
    // ── Stage 2 ──────────────────────────────────────────────────────────────
    roadfighter: { img:'RoadFighter',         hp: 80,  spd: 90,  dmg:12,  pts:180, w:65, h:105 },
    stomper:     { img:'Stomper',             hp: 85,  spd: 70,  dmg:14,  pts:190, w:70, h:110 },
    greenstomper:{ img:'GreenStomper',        hp: 85,  spd: 70,  dmg:14,  pts:190, w:70, h:110 },
    soldier:     { img:'SoldierCrime',        hp: 75,  spd: 95,  dmg:12,  pts:175, w:60, h:100 },
    nastyknifer: { img:'NastyKnifer',         hp: 70,  spd:100,  dmg:15,  pts:200, w:55, h:95  },
    redrowronda: { img:'RedRowRonda',         hp: 70,  spd: 95,  dmg:12,  pts:165, w:55, h:95  },
    // ── Stage 3 ──────────────────────────────────────────────────────────────
    ninja:       { img:'NinjaWarriorOfCrime', hp: 90,  spd:110,  dmg:15,  pts:250, w:60, h:100 },
    divamohawk:  { img:'DivaMohawk',          hp: 80,  spd:100,  dmg:13,  pts:220, w:55, h:95  },
    slender:     { img:'SlenderCriminal',     hp: 75,  spd:115,  dmg:12,  pts:210, w:50, h:100 },
    nunchuck:    { img:'NunChuckLarry',       hp: 95,  spd: 90,  dmg:18,  pts:260, w:65, h:105 },
    hyjung:      { img:'HyJungScout',         hp: 80,  spd:105,  dmg:13,  pts:230, w:55, h:95  },
    lowgoblin:   { img:'LowGoblin',           hp: 65,  spd:100,  dmg:11,  pts:200, w:50, h:80  },
    // ── Sub-bosses ────────────────────────────────────────────────────────────
    squirrly:    { img:'SquirrlyGambler',     hp:150,  spd:100,  dmg:15,  pts:400, w:65, h:110, mini:true },
    greenjetter: { img:'GreenJetter',         hp:180,  spd: 95,  dmg:18,  pts:500, w:70, h:115, mini:true },
    badblob:     { img:'BadBlob',             hp:200,  spd: 80,  dmg:20,  pts:600, w:80, h:110, mini:true },
    maskedmayhem:{ img:'MaskedMayhem',        hp:280,  spd: 95,  dmg:22,  pts:800, w:75, h:118, boss:true },
    // ── Final Boss ────────────────────────────────────────────────────────────
    kingbrute:   { img:'KingBruteBreaker',    hp:550,  spd: 85,  dmg:30,  pts:2000,w:92, h:148, boss:true },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY CLASS
// ─────────────────────────────────────────────────────────────────────────────
// Note 40: Enemy also extends Entity, sharing gravity, movement, state, and draw helpers.
// The AI runs inside update(). It is a multi-phase state machine:
//   engageDelay > 0  — enemy flanks/circles the player before committing to rush
//   dist > closeEnough — rushing toward the player
//   dist <= closeEnough — attacking the player if depth-aligned
class Enemy extends Entity {
    constructor(x, y, typeId) {
        // Note 41: The fallback to ENEMY_DEFS.crimeguy prevents a crash if an unknown
        // typeId is passed. Useful during development when adding new enemy types.
        const def = ENEMY_DEFS[typeId] || ENEMY_DEFS.crimeguy;
        super(x, y, def.w, def.h);
        this.typeId    = typeId;
        this.def       = def;
        this.hp        = Math.round(def.hp * CFG.enemyHealthMultiplier);
        this.maxHp     = this.hp;
        this.speed     = def.spd;
        this.atkCD     = 1.0 + Math.random() * 2;
        this.downT     = 0;
        this.invincible= false;
        this.deadT     = 0;
        this.engageDelay = CFG.enemyEngageDelayMin + Math.random() * CFG.enemyEngageDelayMax;
        this.flankDir    = Math.random() < 0.5 ? 1 : -1;
        // Each enemy gets a random depth offset so flanking enemies spread across the
        // walkable zone instead of all stacking at the same Y as the player.
        this.depthSlot   = (Math.random() - 0.5) * 80;
    }

    get isDone()  { return this.dead && this.deadT > CFG.defeatFadeDelay; }

    update(dt, player, allEnemies = []) {
        this.stepState(dt);
        this.applyGravity(dt);
        if (this.dead) { this.deadT += dt; return; }
        if (this.atkCD > 0) this.atkCD -= dt;

        // ── Knockdown ────────────────────────────────────────────────────────
        if (this.state === 'knockdown') {
            this.downT -= dt;
            if (this.downT <= 0) {
                this.setState('getup', CFG.enemyGetupTime);
                this.invincible = true;
            }
            return;
        }
        if (this.state === 'getup') { return; }
        if (this.state === 'hurt')  { return; }
        if (this.state === 'knockedUp') { return; }

        // ── Active AI ─────────────────────────────────────────────────────────
        if (player.hp <= 0) return;
        // Note 43: dx/dy are signed deltas to the player in world space.
        // Math.hypot(dx, dy) is the straight-line 2D distance — equivalent to
        // Math.sqrt(dx*dx + dy*dy) but numerically safer. dist drives the rush/attack decision.
        const dx   = player.x - this.x;
        const dy   = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        this.facing = dx > 0 ? 1 : -1;

        const closeEnough = (this.def.boss || this.def.mini) ? 95 : CFG.enemyCloseEnough;

        // ── Engage delay: flank slowly until ready to rush ────────────────────
        if (this.engageDelay > 0) {
            this.engageDelay -= dt;
            // Drift toward flanking position — approach player's side at medium range.
            // depthSlot offsets the Y target so each enemy settles at a unique depth.
            const flankX = player.x + this.flankDir * (160 + 45 * Math.sin(this.animT * 0.8));
            const flankY = Math.max(CFG.groundMin, Math.min(CFG.groundMax, player.y + this.depthSlot));
            const fdx    = flankX - this.x;
            const fdy    = flankY - this.y;
            this.vx = Math.abs(fdx) > 50 ? Math.sign(fdx) * this.speed * CFG.enemySpeedMultiplier * 0.32 : 0;
            this.vy = Math.abs(fdy) > 20 ? Math.sign(fdy) * this.speed * CFG.enemySpeedMultiplier * 0.28 : 0;
            this.facing = dx > 0 ? 1 : -1; // always face player while pacing
            if (this.state === 'attack') {
                // Don't interrupt attack animation while re-engaging
            } else if (this.vx !== 0 || this.vy !== 0) {
                if (this.state !== 'walk') this.setState('walk');
                this.moveXY(dt);
            } else {
                if (this.state !== 'idle') this.setState('idle');
            }
            if (cam.x > 0) this.x = Math.max(cam.x - 250, this.x);
            return;
        }

        // ── Count active rushers — limit crowd-rushing ────────────────────────
        // Note 44: To prevent every enemy from piling on at once, only maxSimul enemies
        // are allowed to rush simultaneously (1 for regular, 2 for mini-bosses, 4 for bosses).
        // Others hold at a flanking position and wait their turn. This produces the classic
        // beat-em-up behavior where enemies take turns attacking.
        const maxSimul = this.def.boss ? 4 : this.def.mini ? 2 : 1;
        const activeRushers = allEnemies.filter(e =>
            e !== this && !e.dead && e.engageDelay <= 0 &&
            Math.hypot(player.x - e.x, player.y - e.y) <= closeEnough + 90
        ).length;

        if (dist > closeEnough) {
            if (activeRushers < maxSimul) {
                // Rush toward player
                if (Math.abs(dx) > 20) this.vx = this.facing * this.speed * CFG.enemySpeedMultiplier;
                else                   this.vx = 0;
                if (Math.abs(dy) > 12) this.vy = (dy > 0 ? 1 : -1) * this.speed * CFG.enemySpeedMultiplier * 0.5;
                else                   this.vy = 0;
                if (this.state !== 'walk' && this.state !== 'attack') this.setState('walk');
                if (this.state !== 'attack') this.moveXY(dt);
            } else {
                // Too many rushing — hold at flank distance, bob in place
                const holdX = player.x + this.flankDir * (closeEnough + 100);
                const hdx   = holdX - this.x;
                this.vx = Math.abs(hdx) > 35 ? Math.sign(hdx) * this.speed * CFG.enemySpeedMultiplier * 0.28 : 0;
                this.vy = Math.abs(dy)  > 22 ? Math.sign(dy)  * this.speed * CFG.enemySpeedMultiplier * 0.22 : 0;
                if (this.vx !== 0 || this.vy !== 0) {
                    if (this.state !== 'walk' && this.state !== 'attack') this.setState('walk');
                    if (this.state !== 'attack') this.moveXY(dt);
                } else {
                    if (this.state !== 'idle' && this.state !== 'attack') this.setState('idle');
                }
            }
        } else {
            this.vx = 0; this.vy = 0;
            if (this.state !== 'attack' && this.state !== 'idle') this.setState('idle');

            // Use feet-to-feet depth comparison for attack trigger
            const feet_dy = (player.y + player.h) - (this.y + this.h);
            if (this.atkCD <= 0 && Math.abs(feet_dy) < 50) {
                this.setState('attack', CFG.enemyAttackDuration);
                this.atkCD = (this.def.boss ? 1.1 : this.def.mini ? 1.5 : CFG.enemyAtkCooldown) + Math.random();
                this.engageDelay = CFG.enemyReengageMin + Math.random() * CFG.enemyReengageRange;

                // Note 45: The hit is deferred 270ms to match the mid-point of the attack
                // animation (roughly when the fist/weapon would connect visually).
                // We snapshot the enemy's position at the moment of attack (snapX, snapFeetY)
                // then check if the player is still close enough when the timer fires.
                // Using an arrow function means 'this' still refers to the Enemy instance
                // inside the setTimeout callback — regular functions would lose 'this'.
                const snapX = this.x, snapY = this.y, snapFacing = this.facing;
                const snapFeetY = snapY + this.h;
                setTimeout(() => {
                    if (this.dead || player.invT > 0 || player.dead) return;
                    const pdx = Math.abs(player.x - snapX);
                    // Note 46: Feet-to-feet depth comparison — same principle as Note 35.
                    const pdy = Math.abs((player.y + player.h) - snapFeetY);
                    if (pdx < CFG.enemyAtkCheckDist && pdy < CFG.enemyAtkDepthTol)
                        player.takeDamage(Math.round(this.def.dmg * CFG.enemyDmgMultiplier), snapFacing);
                }, CFG.enemyAtkHitDelay);
            }
        }

        // Keep enemy in a reasonable world range
        if (cam.x > 0) this.x = Math.max(cam.x - 250, this.x);

        // Push this enemy away from any overlapping enemies
        this._separate(allEnemies);
    }

    // Resolve overlap with other enemies by nudging positions apart.
    // Runs after all movement so it never fights the AI velocity decisions.
    _separate(allEnemies) {
        for (const other of allEnemies) {
            if (other === this || other.dead) continue;
            const cx = (this.x + this.w * 0.5) - (other.x + other.w * 0.5);
            const cy = (this.y + this.h * 0.5) - (other.y + other.h * 0.5);
            const minX = this.w * 0.5 + other.w * 0.5 + 4;   // desired min center-to-center X
            const minY = this.h * 0.4 + other.h * 0.4;        // desired min center-to-center Y
            if (Math.abs(cx) < minX && Math.abs(cy) < minY) {
                // Overlapping — push along each axis proportional to the penetration depth
                const pushX = (minX - Math.abs(cx)) * Math.sign(cx || 1) * 0.5;
                const pushY = (minY - Math.abs(cy)) * Math.sign(cy || 1) * 0.5;
                this.x += pushX;
                this.y += pushY;
                this.y  = Math.max(CFG.groundMin, Math.min(CFG.groundMax, this.y));
            }
        }
    }

    _onStateEnd() {
        if (this.state === 'getup') {
            this.invincible  = false;
            this.engageDelay = CFG.enemyGetupReengageMin + Math.random();
        }
        this.setState('idle');
    }

    _onLand() {
        if (this.state === 'knockedUp') {
            this.setState('knockdown');
            this.downT     = CFG.enemyKnockdownTime;
            this.invincible = false;
        }
    }

    takeDamage(amount, dir, launch = 0) {
        if (this.dead || this.invincible) return;
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this._die(); return; }
        if (launch > 0) {
            this.vz = launch; this.x += dir * CFG.enemyLaunchKnockbackDist;
            this.setState('knockedUp'); // no timer — _onLand handles transition
            this.invincible = true;
        } else {
            this.x += dir * CFG.enemyKnockbackDist;
            this.setState('hurt', 0.35);
        }
    }

    _die() {
        this.dead  = true;
        this.deadT = 0;
        this.state = 'dead';
        addScore(this.def.pts);
    }

    getImg() {
        const c = ENEMY_CHARS[this.def.img];
        if (!c) return null;
        switch (this.state) {
            case 'walk':
                if (c.walk) return Math.floor(this.animT * CFG.enemyWalkFPS) % 2 === 0 ? c.idle : c.walk;
                return c.idle;
            case 'attack': {
                // Resolve attack sprite: punch → kick → generic attack fallback
                const atk = c.punch || c.kick || c.attack;
                if (!(atk && atk.naturalWidth > 0)) return c.idle;  // no sprite — draw() handles rotation
                return atk;  // hold the frame for the full attack duration, like player punch/kick
            }
            case 'hurt':
            case 'knockedUp':
            case 'getup':
            case 'knockdown':
                return c.idle;
            case 'dead':
                return c.defeat || c.idle;
            default:
                return c.idle;
        }
    }

    draw() {
        if (this.isDone) return;
        this.drawShadow();

        const img = this.getImg();
        if (!img) return;

        // Hurt flash
        const flash = this.state === 'hurt' && Math.floor(this.animT * CFG.enemyHurtFlashFPS) % 2 === 0;

        const dw = img.naturalWidth  || this.w;
        const dh = img.naturalHeight || this.h;

        ctx.save();
        if (flash) ctx.globalAlpha = CFG.hitFlashAlpha;
        // Anchor at feet-center so the hitbox bottom stays fixed; sprite overflows naturally
        ctx.translate(this.screenX + this.w / 2, this.drawY + this.h);

        const charDef = ENEMY_CHARS[this.def.img];
        const useRotateDeath = !charDef?.defeat && this.dead;

        if (this.dead) {
            // CFG defeat transforms (debug tuning) multiplied by per-character defeat scale.
            const csc    = _charScale(this.def.img, 'defeat');
            const defRad = CFG.defeatRotation * Math.PI / 180;
            if (useRotateDeath) {
                ctx.rotate(-Math.PI / 2 + defRad);
                ctx.translate(CFG.defeatOffsetX + dh * 0.5, -CFG.defeatOffsetY + dw * 0.1);
            } else {
                ctx.rotate(defRad);
                ctx.translate(CFG.defeatOffsetX * this.facing, -CFG.defeatOffsetY);
            }
            ctx.scale(this.facing * CFG.defeatScaleX * csc.sx, CFG.defeatScaleY * csc.sy);
        } else {
            const csc = _charScale(this.def.img, _enemyStateKey(this.state));
            ctx.scale(this.facing * csc.sx, csc.sy);
            if (this.state === 'attack' && !(charDef?.punch?.naturalWidth > 0) && !(charDef?.kick?.naturalWidth > 0) && !(charDef?.attack?.naturalWidth > 0)) {
                // No real attack sprite — rotate 10° toward player for 0.5s, then rotate back
                const maxAngle = Math.PI / 18; // 10 degrees
                if (this.animT < 0.5) {
                    ctx.rotate(maxAngle);
                } else {
                    const t = Math.min(1, (this.animT - 0.5) / 0.3);
                    ctx.rotate(maxAngle * (1 - t));
                }
            }
        }
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        ctx.restore();

        // Boss/mini HP bar
        if ((this.def.boss || this.def.mini) && !this.dead) {
            const bx = this.screenX;
            const by = this.drawY - 14;
            ctx.fillStyle = '#000';
            ctx.fillRect(bx, by, this.w, 8);
            ctx.fillStyle = '#e53e3e';
            ctx.fillRect(bx, by, this.w * (this.hp / this.maxHp), 8);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HIT EFFECT
// ─────────────────────────────────────────────────────────────────────────────
// Note 48: HitFX is a short-lived particle-style object. It is created on hit,
// updated every frame by decrementing t, and removed from the effects array when
// t <= 0 (the 'done' getter). This "create/update/remove" lifecycle pattern is
// standard for particles, projectiles, and any object with a limited lifespan.
class HitFX {
    constructor(wx, wy, type = 'small') {
        this.wx   = wx; this.wy = wy;
        // Note 49: wx/wy are stored in world space (not screen space) because
        // cam.x is subtracted at draw time. This keeps the effect anchored to the
        // world position even if the camera moves between creation and drawing.
        this.type = type;
        const dur = { small:0.25, medium:0.3, hard:0.45 };
        const sz  = { small:38,   medium:52,  hard:72   };
        this.max  = dur[type] || 0.3;
        this.t    = this.max;
        this.size = sz[type] || 40;
    }
    get done() { return this.t <= 0; }
    get img()  {
        if (this.type === 'small')  return EFFECTS.small;
        if (this.type === 'hard')   return EFFECTS.hard;
        return EFFECTS.medium;
    }
    update(dt) { this.t -= dt; }
    draw() {
        // Note 50: 'a' goes from 1.0 (full opacity, just spawned) to 0.0 (invisible, expired).
        // 's' goes from 1.0 to 1.4, growing the sprite as it fades — a classic impact pop effect.
        // The combination of growing + fading produces the "hit flash" visual feel.
        const a = this.t / this.max;
        const s = 1 + (1 - a) * 0.4;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(this.wx - cam.x, this.wy);
        ctx.scale(s, s);
        ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BREAKABLE OBJECT
// ─────────────────────────────────────────────────────────────────────────────
// Note 51: IMPORTANT coordinate convention — BreakableObj.y is the BOTTOM of the
// sprite (the ground contact point). The sprite is drawn UPWARD: ctx.drawImage starts
// at y - h and goes down to y. This differs from Entity where y is the sprite TOP.
// All collision checks involving BreakableObj must account for this (see _doAttack).
class BreakableObj {
    constructor(wx, wy) {
        this.x = wx; this.y = wy;
        this.broken = false;
        this.w = 48; this.h = 56;
    }
    smash(effects, pickups) {
        if (this.broken) return;
        this.broken = true;
        effects.push(new HitFX(this.x + 24, this.y - 20, 'medium'));
        // Note 52: Math.random() < 0.65 gives a 65% chance of dropping a health pickup.
        // To change the drop rate, adjust this threshold. To add more drop types, add
        // more conditions here with their own probability checks.
        if (Math.random() < 0.65)
            pickups.push(new Pickup(this.x + 8 + Math.random() * 28, this.y - 10, 'health'));
    }
    draw() {
        const img = this.broken ? OBJECTS.broken : OBJECTS.intact;
        const sx  = this.x - cam.x;
        ctx.drawImage(img, sx, this.y - this.h, this.w, this.h);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PICKUP
// ─────────────────────────────────────────────────────────────────────────────
class Pickup {
    constructor(wx, wy, type) {
        this.x = wx; this.y = wy; this.type = type;
        this.taken = false; this.bt = 0;
    }
    update(dt) { this.bt += dt; }
    draw() {
        if (this.taken) return;
        // Note 53: Math.sin(bt * 4) * 4 produces a smooth up-down bob oscillating
        // 4 pixels above and below the base position, cycling roughly once per 1.6 seconds.
        // Increase the multiplier on bt to bob faster; increase the outer 4 to bob higher.
        const bob = Math.sin(this.bt * 4) * 4;
        const sx  = this.x - cam.x;
        ctx.drawImage(OBJECTS.health, sx - 14, this.y - 32 + bob, 28, 28);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL DATA
// ─────────────────────────────────────────────────────────────────────────────
// Note 54: STAGES is the game's level definition table. Each stage is a plain object
// containing all the data LevelMgr needs to run that stage. This data-driven approach
// means you can add a new stage without modifying the LevelMgr class logic — just
// append a new object to this array and it will be picked up automatically.
// waves: array of { gang: [[typeId, relativeX], ...] }
//   Each inner pair is [enemyTypeId, relX from camera when spawned].
//   Enemies enter from off the right edge of the screen and walk toward the player.
// objects: [[relX, absY], ...]  — absY is the BOTTOM of the breakable sprite (Note 51).
const STAGES = [
    {
        name: 'STAGE 1: THE STREETS',
        bgIdx: 0,
        waves: [
            { gang: [['crimeguy',350],['badgirl',600],['jammingjabber',850]] },
            { gang: [['tightromper',320],['sassygirl',570],['crimeguy',820],['jumpingjunkie',1070]] },
        ],
        subboss: 'squirrly',
        boss:    'maskedmayhem',
        objects: [[380,545],[670,555],[1050,535],[1540,550]],
    },
    {
        name: 'STAGE 2: THE DOCKS',
        bgIdx: 1,
        waves: [
            { gang: [['roadfighter',350],['stomper',620],['redrowronda',870]] },
            { gang: [['greenstomper',300],['soldier',550],['nastyknifer',800],['roadfighter',1050]] },
        ],
        subboss: 'greenjetter',
        boss:    'maskedmayhem',
        objects: [[340,550],[720,560],[1090,540],[1480,550]],
    },
    {
        name: 'STAGE 3: THE HIDEOUT',
        bgIdx: 2,
        waves: [
            { gang: [['ninja',350],['divamohawk',620],['slender',870]] },
            { gang: [['nunchuck',300],['hyjung',540],['lowgoblin',790],['ninja',1040]] },
        ],
        subboss: 'badblob',
        boss:    'kingbrute',
        objects: [[310,548],[660,562],[990,538],[1380,552]],
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL MANAGER
// ─────────────────────────────────────────────────────────────────────────────
// Note 55: LevelMgr is a finite state machine (FSM) that drives the stage flow.
// The 'phase' string is the current state. update() checks it each frame and
// transitions to the next state when the exit condition is met (enemies dead, player
// walked far enough, etc.). This is a clean way to sequence game events without
// nested booleans or a sprawling if/else tree.
// Phases:
//   intro → wave → (repeat) → scrollSubboss → subboss → scrollBoss → boss → clear
class LevelMgr {
    constructor(stageIdx) {
        this.data        = STAGES[stageIdx];
        this.stageIdx    = stageIdx;
        this.phase       = 'intro';
        this.introT      = 2.8;
        this.waveIdx     = 0;
        this.clearT      = 0;
        this.locked      = false;   // camera locked during wave/boss
        this.trackedBoss = null;
        this.scrollGoal  = 0;       // absolute player.x to advance from scroll phases
    }

    _spawnWave(enemies, breakables) {
        const wave = this.data.waves[this.waveIdx];
        wave.gang.forEach(([id, relX], i) => {
            const y = CFG.groundMin + 40 + Math.random() * (CFG.groundMax - CFG.groundMin - 50);
            const e = new Enemy(cam.x + W + 60 + i * 85, y, id);
            // Fan out: alternate flanks so enemies spread around player naturally
            e.flankDir    = (i % 2 === 0) ? 1 : -1;
            // Stagger engagement: each subsequent enemy waits longer before rushing
            e.engageDelay = 0.5 + i * 0.9 + Math.random() * 0.6;
            enemies.push(e);
        });
        this.locked = true;
    }

    _spawnObjects(breakables) {
        this.data.objects.forEach(([rx, ry]) => {
            breakables.push(new BreakableObj(cam.x + rx, ry));
        });
    }

    _allDead(enemies) {
        return enemies.every(e => e.isDone);
    }

    update(dt, player, enemies, breakables) {
        const alive = enemies.filter(e => !e.isDone);

        // ── INTRO ─────────────────────────────────────────────────────────────
        if (this.phase === 'intro') {
            this.introT -= dt;
            if (this.introT <= 0) {
                this.phase = 'wave';
                this._spawnWave(enemies, breakables);
                this._spawnObjects(breakables);
            }
            return;
        }

        // ── Camera scroll when unlocked ────────────────────────────────────────
        // Note 56: When the camera is unlocked (between waves) it lerps (linear interpolates)
        // toward a target position slightly behind the player. The formula (target - cam.x) * dt * 4
        // is exponential decay — the gap closes by 4x per second, so the camera feels like it
        // "catches up" smoothly. Math.max(cam.x, ...) prevents the camera from scrolling back left.
        if (!this.locked) {
            const target = Math.max(cam.x, player.x - 160);
            cam.x += (target - cam.x) * dt * 4;
        }

        // ── WAVE ──────────────────────────────────────────────────────────────
        if (this.phase === 'wave') {
            if (alive.length === 0) {
                this.waveIdx++;
                if (this.waveIdx < this.data.waves.length) {
                    this.phase      = 'scrollWave';
                    this.locked     = false;
                    this.scrollGoal = player.x + 500;  // player must walk 500px more
                } else {
                    this.phase      = 'scrollSubboss';
                    this.locked     = false;
                    this.scrollGoal = player.x + 600;
                }
            }
            return;
        }

        // ── SCROLL TO NEXT WAVE ───────────────────────────────────────────────
        if (this.phase === 'scrollWave') {
            if (player.x >= this.scrollGoal) {
                this.phase = 'wave';
                this._spawnWave(enemies, breakables);
            }
            return;
        }

        // ── SCROLL TO SUB-BOSS ────────────────────────────────────────────────
        if (this.phase === 'scrollSubboss') {
            if (player.x >= this.scrollGoal) {
                this.phase  = 'subboss';
                this.locked = true;
                const sb = new Enemy(cam.x + W - 100, 450, this.data.subboss);
                enemies.push(sb);
                _showBossHUD(this.data.subboss.toUpperCase().replace('_',' '), sb);
                this.trackedBoss = sb;
            }
            return;
        }

        // ── SUB-BOSS ──────────────────────────────────────────────────────────
        if (this.phase === 'subboss') {
            _updateBossBar(this.trackedBoss);
            if (alive.length === 0) {
                _hideBossHUD();
                this.phase      = 'scrollBoss';
                this.locked     = false;
                this.scrollGoal = player.x + 600;
            }
            return;
        }

        // ── SCROLL TO BOSS ────────────────────────────────────────────────────
        if (this.phase === 'scrollBoss') {
            if (player.x >= this.scrollGoal) {
                this.phase  = 'boss';
                this.locked = true;
                const b = new Enemy(cam.x + W - 110, 450, this.data.boss);
                enemies.push(b);
                _showBossHUD(this.data.boss.toUpperCase().replace('_',' '), b);
                this.trackedBoss = b;
            }
            return;
        }

        // ── BOSS ──────────────────────────────────────────────────────────────
        if (this.phase === 'boss') {
            _updateBossBar(this.trackedBoss);
            if (alive.length === 0) {
                _hideBossHUD();
                this.phase = 'clear';
                this.clearT = 3.0;
            }
            return;
        }

        // ── CLEAR ─────────────────────────────────────────────────────────────
        if (this.phase === 'clear') {
            this.clearT -= dt;
            if (this.clearT <= 0) {
                if (this.stageIdx < STAGES.length - 1) {
                    gameState = 'stageclear';
                    showOverlay(`STAGE ${this.stageIdx + 1} CLEAR!`, `Score: ${score}`);
                } else {
                    gameState = 'victory';
                    showOverlay('YOU WIN!', `Final Score: ${score}`);
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD HELPERS
// ─────────────────────────────────────────────────────────────────────────────
// Note 57: HUD helper functions are prefixed with _ (underscore convention for "private").
// They all manipulate DOM elements declared at the top of the file. Because the game
// runs inside a single HTML page, DOM manipulation is the simplest way to render UI
// without a separate rendering pipeline. CSS transitions on the health bar width handle
// the smooth shrink animation automatically.
function _hpHUD(p) {
    // Note 58: Dividing hp by maxHp gives a ratio 0..1; multiplying by 100 converts to a
    // CSS percentage. This works for both the player and any entity passed in.
    healthFill.style.width = (p.hp / p.maxHp * 100) + '%';
}

let _bossRef = null;
function _showBossHUD(name, entity) {
    _bossRef = entity;
    bossNameEl.textContent = name;
    bossHud.classList.remove('hidden');
    bossFill.style.width = '100%';
}
function _hideBossHUD() {
    bossHud.classList.add('hidden');
    _bossRef = null;
}
function _updateBossBar(e) {
    if (!e) return;
    bossFill.style.width = (e.hp / e.maxHp * 100) + '%';
}

function _updateComboHUD(n) {
    if (n < 2) { comboDisplay.classList.add('hidden'); return; }
    comboEl.textContent = n;
    comboDisplay.classList.remove('hidden');
    // Note 59: This is the CSS animation restart trick. Setting animation to 'none',
    // reading offsetWidth (which forces a reflow/style recalculation), then restoring
    // animation causes the browser to restart the CSS keyframes from the beginning.
    // Without the void read, the browser may batch the style changes and skip the restart.
    comboDisplay.style.animation = 'none';
    void comboDisplay.offsetWidth;
    comboDisplay.style.animation = '';
}

function showOverlay(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent   = sub;
    overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND DRAW
// ─────────────────────────────────────────────────────────────────────────────
// Note 60: drawBg implements infinite parallax scrolling using only two image draws.
// The background image is 1600px wide (2x the 800px canvas). parallax = cam.x * 0.45
// makes the background scroll at 45% of the foreground speed, creating depth illusion.
// 'offset' is the remainder after dividing by bgW, so it wraps smoothly at 1600px.
// Drawing two copies side-by-side (at -offset and bgW-offset) ensures there is never
// a gap visible on screen as the offset cycles.
function drawBg(bgIdx) {
    const bgImg    = BACKGROUNDS[Math.min(bgIdx, BACKGROUNDS.length - 1)];
    const bgW      = 1600;
    const parallax = cam.x * 0.45;
    const offset   = parallax % bgW;
    ctx.drawImage(bgImg,     -offset,         0, bgW, H);
    ctx.drawImage(bgImg, bgW - offset,        0, bgW, H);

    // Note 61: A linear gradient overlay darkens the ground zone toward the front of the
    // scene, reinforcing the perspective depth cue. createLinearGradient takes two points
    // defining the gradient axis; addColorStop places color markers along that axis.
    const grd = ctx.createLinearGradient(0, CFG.groundMin, 0, CFG.groundMax + 30);
    grd.addColorStop(0,   'rgba(0,0,0,0)');
    grd.addColorStop(1,   'rgba(0,0,0,0.25)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, CFG.groundMin, W, CFG.groundMax - CFG.groundMin + 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GAME OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
let player, enemies, effects, breakables, pickups, levelMgr;
let lastTime = 0;

// Note 62: initStage resets all per-stage state. Arrays are replaced with fresh empty
// arrays rather than cleared in-place (enemies = [] vs enemies.length = 0) because
// other code may still hold references to the old arrays mid-frame. Replacing them
// is safe here since initStage is only called between stages, never mid-update.
function initStage(idx) {
    currentStageIdx = idx;
    stageEl.textContent = idx + 1;
    cam.x = 0; cam.power = 0;

    enemies    = [];
    effects    = [];
    breakables = [];
    pickups    = [];
    levelMgr   = new LevelMgr(idx);

    hideOverlay();
    _hideBossHUD();
    _updateComboHUD(0);
    gameState = 'playing';
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

function buildDebugPanel() {
    const panel = document.getElementById('debug-panel');
    const rows = [
        { section: 'ATTACK RANGES (px)' },
        { key:'punchRange',              label:'Punch Range',         min:10,  max:200,  step:1   },
        { key:'kickRange',               label:'Kick Range',          min:10,  max:200,  step:1   },
        { key:'uppercutRange',           label:'Uppercut Range',      min:10,  max:150,  step:1   },
        { key:'runningKickRange',        label:'Running Kick Range',  min:20,  max:250,  step:1   },
        { key:'jumpKickRange',           label:'Jump Kick Range',     min:20,  max:200,  step:1   },
        { section: 'ATTACK DAMAGE' },
        { key:'punchDmg',                label:'Punch Damage',        min:1,   max:150,  step:1   },
        { key:'kickDmg',                 label:'Kick Damage',         min:1,   max:150,  step:1   },
        { key:'uppercutDmg',             label:'Uppercut Damage',     min:1,   max:200,  step:1   },
        { key:'runningKickDmg',          label:'Running Kick Dmg',    min:1,   max:200,  step:1   },
        { key:'jumpKickDmg',             label:'Jump Kick Damage',    min:1,   max:200,  step:1   },
        { section: 'MOVEMENT' },
        { key:'playerSpeed',             label:'Player Speed',        min:50,  max:600,  step:5   },
        { key:'jumpSpeed',               label:'Jump Speed',          min:100, max:1200, step:10  },
        { key:'gravity',                 label:'Gravity',             min:100, max:2500, step:10  },
        { section: 'ANIMATION (fps)' },
        { key:'playerWalkFPS',           label:'Player Walk FPS',     min:1,   max:20,   step:1   },
        { key:'playerIdleFPS',           label:'Player Idle FPS',     min:1,   max:10,   step:1   },
        { key:'enemyWalkFPS',            label:'Enemy Walk FPS',      min:1,   max:20,   step:1   },
        { key:'enemyAttackDuration',     label:'Attack Hold (s)',     min:0.1, max:4.0,  step:0.05},
        { key:'enemyAttackFrameHold',    label:'Frame Hold (s)',      min:0,   max:2.0,  step:0.05},
        { key:'enemyAttackFPS',          label:'Enemy Attack FPS',    min:1,   max:30,   step:1   },
        { key:'enemyHurtFlashFPS',       label:'Enemy Hurt Flash FPS',min:1,   max:60,   step:1   },
        { section: 'PLAYER HIT DETECTION (px)' },
        { key:'collisionBodyOverlap',    label:'Body Overlap',        min:0,   max:60,   step:1   },
        { key:'collisionDepthTol',       label:'Depth Tol (Y)',       min:5,   max:100,  step:1   },
        { section: 'OBJECT COLLISION (px)' },
        { key:'objCollisionRange',       label:'Obj Hit Range',       min:10,  max:200,  step:1   },
        { key:'objCollisionOverlap',     label:'Obj Body Overlap',    min:0,   max:60,   step:1   },
        { key:'objCollisionDepthTol',    label:'Obj Depth Tol',       min:5,   max:120,  step:1   },
        { key:'pickupRange',             label:'Pickup Range',        min:10,  max:150,  step:1   },
        { key:'pickupDepthTol',          label:'Pickup Depth Tol',    min:10,  max:120,  step:1   },
        { section: 'ENEMY AI' },
        { key:'enemyCloseEnough',        label:'Attack Dist',         min:20,  max:200,  step:1   },
        { key:'enemyAtkCheckDist',       label:'Hit Reach',           min:20,  max:200,  step:1   },
        { key:'enemyAtkDepthTol',        label:'Hit Depth Tol',       min:5,   max:100,  step:1   },
        { key:'enemyAtkCooldown',        label:'Atk Cooldown',        min:0.3, max:5,    step:0.1 },
        { section: 'ENEMY ATTACK' },
        { key:'enemyAtkHitDelay',        label:'Hit Delay (ms)',      min:0,   max:800,  step:10  },
        { key:'enemyKnockbackDist',      label:'Knockback Dist',      min:0,   max:120,  step:1   },
        { key:'enemyLaunchKnockbackDist',label:'Launch Knockback',    min:0,   max:200,  step:1   },
        { section: 'HIT RESPONSE' },
        { key:'playerHurtInvTime',       label:'Player Inv Time',     min:0,   max:3,    step:0.05},
        { key:'playerKnockdownTime',     label:'Player Knockdown',    min:0.3, max:5,    step:0.1 },
        { key:'enemyKnockdownTime',      label:'Enemy Knockdown',     min:0.3, max:5,    step:0.1 },
        { key:'enemyGetupTime',          label:'Enemy Getup Time',    min:0.1, max:2,    step:0.05},
        { key:'hitFlashAlpha',           label:'Hurt Flash Alpha',    min:0,   max:1,    step:0.05},
        { section: 'ENEMY MULTIPLIERS' },
        { key:'enemyDmgMultiplier',      label:'Damage ×',           min:0.1, max:5,    step:0.05},
        { key:'enemySpeedMultiplier',    label:'Speed ×',            min:0.1, max:5,    step:0.05},
        { key:'enemyHealthMultiplier',   label:'Health × (at spawn)',min:0.1, max:5,    step:0.05},
        { section: 'ENEMY ENGAGEMENT' },
        { key:'enemyEngageDelayMin',     label:'Engage Delay Min',   min:0,   max:6,    step:0.1 },
        { key:'enemyEngageDelayMax',     label:'Engage Delay Range', min:0,   max:6,    step:0.1 },
        { key:'enemyReengageMin',        label:'Re-engage Min',      min:0,   max:5,    step:0.1 },
        { key:'enemyReengageRange',      label:'Re-engage Range',    min:0,   max:5,    step:0.1 },
        { key:'enemyGetupReengageMin',   label:'Getup Re-engage',    min:0,   max:4,    step:0.1 },
        { section: 'SCORE' },
        { key:'scoreMultiplier',         label:'Score ×',            min:0,   max:10,   step:0.1 },
        { section: 'COMBO' },
        { key:'comboTimeout',            label:'Combo Timeout (s)',   min:0.5, max:8,    step:0.1 },
        { section: 'ARENA (debug)' },
        { key:'groundMin',               label:'Ground Top (Y)',      min:200, max:480,  step:1   },
        { key:'groundMax',               label:'Ground Bot (Y)',      min:400, max:580,  step:1   },
        { section: 'DEFEAT SPRITE' },
        { key:'defeatScaleX',            label:'Scale X',             min:0.1, max:4,    step:0.05},
        { key:'defeatScaleY',            label:'Scale Y',             min:0.1, max:4,    step:0.05},
        { key:'defeatRotation',          label:'Rotation (deg)',      min:-180,max:180,  step:1   },
        { key:'defeatOffsetX',           label:'Offset X',            min:-200,max:200,  step:1   },
        { key:'defeatOffsetY',           label:'Offset Y',            min:-200,max:200,  step:1   },
        { key:'defeatFadeDelay',         label:'Fade Delay (s)',      min:0,   max:10,   step:0.1 },
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
    html += '<button id="dbg-export">&#x2B07; Export configuration.json</button>';
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
    delete out.infiniteHealth; // debug-only flag, not a game config value
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'configuration.json';
    a.click();
    URL.revokeObjectURL(a.href);
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

function newGame() {
    score = 0;
    scoreEl.textContent = '000000';
    player = new Player(120, 445);
    initStage(0);
}

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

function buildDebugLeftPanel() {
    const panel = document.getElementById('debug-left-panel');
    const options = Object.keys(ENEMY_DEFS)
        .map(k => `<option value="${k}">${k}</option>`)
        .join('');

    panel.innerHTML = `
        <div id="dbg-title">SANDBOX</div>

        <div class="dbg-section">ENEMY</div>
        <select class="dbg-enemy-select" id="dbg-enemy-select">${options}</select>
        <button class="dbg-spawn-btn" id="dbg-spawn-enemy">&#9654; SPAWN ENEMY</button>
        <div class="dbg-status" id="dbg-enemy-status">ready</div>

        <div class="dbg-section">OBJECT</div>
        <button class="dbg-spawn-btn" id="dbg-spawn-obj">&#9654; SPAWN OBJECT</button>
        <div class="dbg-status" id="dbg-obj-status">ready</div>
    `;

    document.getElementById('dbg-spawn-enemy').addEventListener('click', () =>
        spawnDebugEnemy(document.getElementById('dbg-enemy-select').value));
    document.getElementById('dbg-spawn-obj').addEventListener('click', () => {
        spawnDebugObject();
        document.getElementById('dbg-obj-status').textContent = 'object spawned';
    });
}

function advanceStage() {
    const prevLives = player.lives;
    const prevHp    = Math.min(player.maxHp, player.hp + 80); // small bonus
    initStage(currentStageIdx + 1);
    player.lives = prevLives;
    player.hp    = prevHp;
    player.x     = 120; player.y = 445; player.z = 0; player.vz = 0;
    player.invT  = 1.5;
    _hpHUD(player);
    livesEl.textContent = player.lives;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME LOOP
// ─────────────────────────────────────────────────────────────────────────────
// Note 63: The game loop is split into update() and draw(). This separation is good
// practice: update() mutates game state; draw() only reads it and renders. Keeping
// them distinct makes it easier to add features like pause (skip update, keep drawing)
// or to profile rendering vs. logic separately in the browser's performance tools.
function update(dt) {
    updateCamera(dt);
    if (levelMgr) levelMgr.update(dt, player, enemies, breakables);
    player.update(dt, enemies, effects, pickups, breakables);
    enemies.forEach(e => e.update(dt, player, enemies));
    effects.forEach(f => f.update(dt));
    pickups.forEach(p => p.update(dt));

    // Note 64: Array.filter creates a new array containing only elements that pass the test.
    // We replace the live arrays with the filtered results, effectively removing "done" entries.
    // This is called object pooling lite — for a larger game you might reuse objects instead
    // of allocating new ones, but filter is clean and fast enough for this scale.
    enemies    = enemies.filter(e => !e.isDone);
    effects    = effects.filter(f => !f.done);
    pickups    = pickups.filter(p => !p.taken);
}

function draw() {
    ctx.save();
    // Note 65: ctx.translate(shakeX, shakeY) shifts every subsequent draw call by the
    // shake offset, so the entire scene vibrates together. The -10 margin on clearRect
    // ensures the shake offset cannot reveal un-cleared pixels at the canvas edge.
    ctx.translate(cam.shakeX, cam.shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);

    drawBg(STAGES[currentStageIdx].bgIdx);

    // Breakable objects (behind characters)
    breakables.forEach(o => o.draw());

    // Note 66: Sorting entities by their Y (depth) value before drawing creates the
    // painter's algorithm: entities further back (smaller Y) are drawn first and
    // appear behind entities further forward (larger Y). The +0.5 bias for the player
    // ensures the player draws on top of enemies at the exact same depth lane.
    [player, ...enemies]
        .sort((a, b) => (a === player ? a.y + 0.5 : a.y) - (b === player ? b.y + 0.5 : b.y))
        .forEach(e => e.draw());

    // Pickups and effects on top
    pickups.forEach(p => p.draw());
    effects.forEach(f => f.draw());

    // Stage intro overlay
    if (levelMgr && levelMgr.phase === 'intro') {
        const a = Math.min(1, levelMgr.introT / 2.5);
        ctx.fillStyle = `rgba(0,0,0,${a * 0.65})`;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 40px "Courier New"';
        ctx.fillText(levelMgr.data.name, W / 2, H / 2 - 20);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '18px "Courier New"';
        ctx.fillText('J/Z : PUNCH     K/X : KICK     SPACE : JUMP', W / 2, H / 2 + 25);
        ctx.fillText('SHIFT : RUN     ↑ + PUNCH : UPPERCUT     RUN + KICK : RUNNING KICK', W / 2, H / 2 + 50);
    }

    // Stage-clear flash
    if (levelMgr && levelMgr.phase === 'clear') {
        const t = 3.0 - levelMgr.clearT;
        if (Math.floor(t * 5) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.12)';
            ctx.fillRect(-10, -10, W + 20, H + 20);
        }
    }

    if (debugMode) drawDebug();

    ctx.restore();
}

function drawDebug() {
    if (!CFG.showHitboxes) {
        _updateDebugStatus();
        return;
    }
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';

    // ── Player hitbox ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(80,160,255,0.85)';
    ctx.strokeRect(player.screenX, player.drawY, player.w, player.h);
    ctx.fillStyle = 'rgba(80,160,255,0.18)';
    ctx.fillRect(player.screenX, player.drawY, player.w, player.h);
    ctx.fillStyle = 'rgba(80,160,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(player.state, player.screenX + player.w / 2, player.drawY - 4);

    // ── Player attack reach ────────────────────────────────────────────────
    if (player.busy && !['hurt','knockdown','knockedUp'].includes(player.state)) {
        const RANGE  = { punch1:CFG.punchRange, punch2:CFG.punchRange,
                         kick1:CFG.kickRange,   kick2:CFG.kickRange,
                         uppercut:CFG.uppercutRange, runningkick:CFG.runningKickRange,
                         jumpkick:CFG.jumpKickRange };
        const range  = RANGE[player.state] || CFG.punchRange;
        const front  = player.facing === 1 ? player.screenX + player.w : player.screenX;
        const hx1    = player.facing === 1 ? front - CFG.collisionBodyOverlap : front - range;
        const hx2    = player.facing === 1 ? front + range                    : front + CFG.collisionBodyOverlap;
        const hy     = player.drawY + player.h * 0.15;
        const hh     = player.h * 0.7;
        ctx.strokeStyle = 'rgba(255,230,0,0.9)';
        ctx.setLineDash([3,3]);
        ctx.strokeRect(hx1, hy, hx2 - hx1, hh);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,230,0,0.08)';
        ctx.fillRect(hx1, hy, hx2 - hx1, hh);
    }

    // ── Object collision zone ──────────────────────────────────────────────
    if (player.busy && !['hurt','knockdown','knockedUp'].includes(player.state)) {
        const obfront = player.facing === 1 ? player.screenX + player.w : player.screenX;
        const obhx1   = player.facing === 1 ? obfront - CFG.objCollisionOverlap : obfront - CFG.objCollisionRange;
        const obhx2   = player.facing === 1 ? obfront + CFG.objCollisionRange   : obfront + CFG.objCollisionOverlap;
        const obDepthY = player.y + player.h;
        const obsy     = obDepthY - CFG.objCollisionDepthTol - cam.shakeY;
        ctx.strokeStyle = 'rgba(0,255,150,0.7)';
        ctx.setLineDash([2,4]);
        ctx.strokeRect(obhx1, obsy, obhx2 - obhx1, CFG.objCollisionDepthTol * 2);
        ctx.setLineDash([]);
    }

    // ── Enemy hitboxes + attack reach ──────────────────────────────────────
    enemies.forEach(e => {
        const isDead = e.dead;
        ctx.strokeStyle = isDead ? 'rgba(120,120,120,0.5)' : 'rgba(255,60,60,0.85)';
        ctx.strokeRect(e.screenX, e.drawY, e.w, e.h);
        if (!isDead) {
            ctx.fillStyle = 'rgba(255,60,60,0.08)';
            ctx.fillRect(e.screenX, e.drawY, e.w, e.h);
        }
        ctx.fillStyle = isDead ? '#888' : '#f55';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.state}  ${e.hp}hp`, e.screenX + e.w / 2, e.drawY - 4);

        // Enemy attack reach zone (shown during attack state)
        if (e.state === 'attack' && !isDead) {
            const efront = e.facing === 1 ? e.screenX + e.w : e.screenX;
            const ehx1   = e.facing === 1 ? efront - 10                   : efront - CFG.enemyAtkCheckDist;
            const ehx2   = e.facing === 1 ? efront + CFG.enemyAtkCheckDist : efront + 10;
            ctx.strokeStyle = 'rgba(255,80,80,0.7)';
            ctx.setLineDash([3,3]);
            ctx.strokeRect(ehx1, e.drawY + e.h * 0.1, ehx2 - ehx1, e.h * 0.8);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,80,80,0.07)';
            ctx.fillRect(ehx1, e.drawY + e.h * 0.1, ehx2 - ehx1, e.h * 0.8);
        }
    });

    // ── DEBUG label ────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,215,0,0.75)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DEBUG', 6, 14);

    ctx.restore();

    // Keep left-panel enemy status fresh every frame
    _updateDebugStatus();
}

// ─────────────────────────────────────────────────────────────────────────────
// SPRITE VIEWER MODE
// ─────────────────────────────────────────────────────────────────────────────
const viewerState = { charKey: 'CrimeGuy', globalScale: 1.0, selectedIdx: -1 };

// Build the canonical sprite list for the currently viewed character.
// Each entry: { label, stateKey, img }
// stateKey matches charScales keys and the _*StateKey() helpers used at draw time.
function _viewerSprites() {
    const isPlayer = viewerState.charKey === '__player__';
    if (isPlayer) {
        return [
            { label:'idle1',    stateKey:'idle',        img: PLAYER.idle1       },
            { label:'idle2',    stateKey:'idle',        img: PLAYER.idle2       },
            { label:'walk0',    stateKey:'walk',        img: PLAYER.walk0       },
            { label:'walk4',    stateKey:'walk',        img: PLAYER.walk4       },
            { label:'run',      stateKey:'run',         img: PLAYER.run         },
            { label:'jump',     stateKey:'jump',        img: PLAYER.jump        },
            { label:'punch1',   stateKey:'punch1',      img: PLAYER.punch1      },
            { label:'punch2',   stateKey:'punch2',      img: PLAYER.punch2      },
            { label:'kick1',    stateKey:'kick1',       img: PLAYER.kick1       },
            { label:'kick2',    stateKey:'kick2',       img: PLAYER.kick2       },
            { label:'uppercut', stateKey:'uppercut',    img: PLAYER.upperCut    },
            { label:'runKick',  stateKey:'runningkick', img: PLAYER.runningKick },
            { label:'jumpKick', stateKey:'jumpkick',    img: PLAYER.jumpKick    },
            { label:'knockDwn', stateKey:'knockdown',   img: PLAYER.knockDown   },
        ];
    }
    const c = ENEMY_CHARS[viewerState.charKey];
    if (!c) return [];
    const list = [];
    if (c.idle)    list.push({ label:'idle',    stateKey:'idle',    img: c.idle    });
    if (c.walk)    list.push({ label:'walk',    stateKey:'walk',    img: c.walk    });
    if (c.punch)   list.push({ label:'punch',   stateKey:'attack',  img: c.punch   });
    if (c.punch2)  list.push({ label:'punch2',  stateKey:'attack',  img: c.punch2  });
    if (c.kick)    list.push({ label:'kick',    stateKey:'attack',  img: c.kick    });
    if (c.attack)  list.push({ label:'attack',  stateKey:'attack',  img: c.attack  });
    if (c.defeat)  list.push({ label:'defeat',  stateKey:'defeat',  img: c.defeat  });
    return list;
}

// Shared layout constants (recomputed from sprite count each frame & for click handling).
function _viewerLayout(count) {
    const HEADER = 32, FOOTER = 28;
    const cols = Math.min(count, 5);
    const rows = Math.ceil(count / cols);
    const cellW = Math.floor(W / cols);
    const cellH = Math.floor((H - HEADER - FOOTER) / rows);
    return { HEADER, FOOTER, cols, rows, cellW, cellH };
}

function startViewer() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('debug-left-panel').classList.remove('hidden');
    buildViewerPanel();
    gameState = 'viewer';

    // Click a cell to select it and load its state scale into the left panel.
    canvas.addEventListener('click', _viewerClickHandler);
}

function _viewerClickHandler(e) {
    if (gameState !== 'viewer') return;
    const rect   = canvas.getBoundingClientRect();
    const cx     = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const cy     = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const sprites = _viewerSprites();
    if (!sprites.length) return;
    const { HEADER, cellW, cellH, cols } = _viewerLayout(sprites.length);
    if (cy < HEADER) return;
    const col = Math.floor(cx / cellW);
    const row = Math.floor((cy - HEADER) / cellH);
    const idx = row * cols + col;
    if (idx < 0 || idx >= sprites.length) return;
    viewerState.selectedIdx = idx;
    _refreshViewerStatePanel(sprites[idx]);
}

function buildViewerPanel() {
    const panel = document.getElementById('debug-left-panel');
    const charOptions = ['<option value="__player__">PLAYER</option>',
        ...Object.keys(ENEMY_CHARS).map(k => `<option value="${k}">${k}</option>`)
    ].join('');
    panel.innerHTML = `
        <div id="dbg-title">SPRITE VIEWER</div>

        <div class="dbg-section">CHARACTER</div>
        <select class="dbg-enemy-select" id="viewer-char-select">${charOptions}</select>

        <div class="dbg-section">GLOBAL SCALE</div>
        <div class="dbg-row">
            <span class="dbg-label">Preview</span>
            <input type="range" class="dbg-slider" id="viewer-scale"
                   min="0.2" max="5.0" step="0.1" value="1.0">
            <span class="dbg-val" id="viewer-scale-val">1.0×</span>
        </div>

        <div class="dbg-section">SELECTED STATE</div>
        <div class="dbg-status" id="viewer-state-name" style="color:#ffd700;margin-bottom:6px">
            click a cell →
        </div>
        <div class="dbg-row" id="viewer-sx-row" style="display:none">
            <span class="dbg-label">Scale X</span>
            <input type="range" class="dbg-slider" id="viewer-sx"
                   min="0.05" max="5.0" step="0.05" value="1.0">
            <span class="dbg-val" id="viewer-sx-val">1.00</span>
        </div>
        <div class="dbg-row" id="viewer-sy-row" style="display:none">
            <span class="dbg-label">Scale Y</span>
            <input type="range" class="dbg-slider" id="viewer-sy"
                   min="0.05" max="5.0" step="0.05" value="1.0">
            <span class="dbg-val" id="viewer-sy-val">1.00</span>
        </div>

        <button class="dbg-spawn-btn" id="viewer-export"
                style="margin-top:14px">&#x2B07; Export characters.json</button>
        <div class="dbg-status" style="margin-top:8px;color:#555;line-height:1.5">
            Click cell to select.<br>
            Scales applied in-game<br>
            when characters.json loads.
        </div>
    `;

    document.getElementById('viewer-char-select').addEventListener('change', e => {
        viewerState.charKey    = e.target.value;
        viewerState.selectedIdx = -1;
        document.getElementById('viewer-state-name').textContent = 'click a cell →';
        document.getElementById('viewer-sx-row').style.display   = 'none';
        document.getElementById('viewer-sy-row').style.display   = 'none';
    });
    document.getElementById('viewer-scale').addEventListener('input', e => {
        viewerState.globalScale = parseFloat(e.target.value);
        document.getElementById('viewer-scale-val').textContent =
            viewerState.globalScale.toFixed(1) + '×';
    });
    document.getElementById('viewer-sx').addEventListener('input', _viewerScaleInput);
    document.getElementById('viewer-sy').addEventListener('input', _viewerScaleInput);
    document.getElementById('viewer-export').addEventListener('click', exportCharacters);
}

function _viewerScaleInput() {
    const sprites = _viewerSprites();
    const sel     = sprites[viewerState.selectedIdx];
    if (!sel) return;
    const sx = parseFloat(document.getElementById('viewer-sx').value);
    const sy = parseFloat(document.getElementById('viewer-sy').value);
    document.getElementById('viewer-sx-val').textContent = sx.toFixed(2);
    document.getElementById('viewer-sy-val').textContent = sy.toFixed(2);
    _setCharScale(viewerState.charKey, sel.stateKey, sx, sy);
}

function _refreshViewerStatePanel(sprite) {
    const sc = _charScale(viewerState.charKey, sprite.stateKey);
    document.getElementById('viewer-state-name').textContent =
        `${sprite.label}  [${sprite.stateKey}]`;
    const sxEl = document.getElementById('viewer-sx');
    const syEl = document.getElementById('viewer-sy');
    sxEl.value = sc.sx;
    syEl.value = sc.sy;
    document.getElementById('viewer-sx-val').textContent = sc.sx.toFixed(2);
    document.getElementById('viewer-sy-val').textContent = sc.sy.toFixed(2);
    document.getElementById('viewer-sx-row').style.display = 'flex';
    document.getElementById('viewer-sy-row').style.display = 'flex';
}

function exportCharacters() {
    const blob = new Blob([JSON.stringify(charScales, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'characters.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function drawSpriteViewer() {
    ctx.clearRect(0, 0, W, H);
    const bg = BACKGROUNDS[0];
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);

    const sprites = _viewerSprites();
    if (!sprites.length) {
        ctx.fillStyle = '#888'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
        ctx.fillText('No sprites for this character', W / 2, H / 2);
        _drawViewerHeader();
        return;
    }

    const { HEADER, cellW, cellH, cols } = _viewerLayout(sprites.length);
    const gsc = viewerState.globalScale;

    ctx.font = '10px monospace';
    sprites.forEach((s, i) => {
        const col    = i % cols;
        const row    = Math.floor(i / cols);
        const cellX  = col * cellW;
        const cellY  = HEADER + row * cellH;
        const cx     = cellX + cellW / 2;
        const cy     = cellY + cellH / 2;
        const isSelected = i === viewerState.selectedIdx;

        // Cell background
        ctx.fillStyle = isSelected ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(cellX, cellY, cellW, cellH);
        ctx.strokeStyle = isSelected ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = isSelected ? 2 : 1;
        ctx.strokeRect(cellX, cellY, cellW, cellH);
        ctx.lineWidth   = 1;

        if (!s.img || !s.img.naturalWidth) {
            ctx.fillStyle = '#555'; ctx.textAlign = 'center';
            ctx.fillText(s.label, cx, cy);
            return;
        }

        // Per-state scale from charScales
        const csc = _charScale(viewerState.charKey, s.stateKey);
        const dw  = s.img.naturalWidth  * gsc * csc.sx;
        const dh  = s.img.naturalHeight * gsc * csc.sy;

        // Clip sprite to cell interior
        ctx.save();
        ctx.beginPath();
        ctx.rect(cellX + 1, cellY + 1, cellW - 2, cellH - 2);
        ctx.clip();
        // Anchor at foot of cell — matches in-game feet-center anchor
        ctx.drawImage(s.img, cx - dw / 2, cellY + cellH - 18 - dh, dw, dh);
        ctx.restore();

        // Natural bounding box outline (faint reference)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(cx - dw / 2, cellY + cellH - 18 - dh, dw, dh);
        ctx.setLineDash([]);

        // State label + current scale
        const scTxt = (csc.sx === csc.sy)
            ? `×${csc.sx.toFixed(2)}`
            : `×${csc.sx.toFixed(2)},${csc.sy.toFixed(2)}`;
        ctx.fillStyle = isSelected ? '#ffd700' : 'rgba(255,215,0,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.label}  ${scTxt}`, cx, cellY + cellH - 5);
    });

    _drawViewerHeader();
}

function _drawViewerHeader() {
    const isPlayer  = viewerState.charKey === '__player__';
    const charLabel = isPlayer ? 'PLAYER' : viewerState.charKey;
    ctx.fillStyle   = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, 32);
    ctx.fillStyle   = '#ffd700';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(`◈ SPRITE VIEWER  ·  ${charLabel}  ·  preview ×${viewerState.globalScale.toFixed(1)}`, W / 2, 21);
    ctx.fillStyle   = 'rgba(255,255,255,0.3)';
    ctx.font        = '10px monospace';
    ctx.textAlign   = 'right';
    ctx.fillText('ESC — title', W - 6, 21);
    ctx.textAlign   = 'left';
}

function drawTitle() {
    ctx.clearRect(0, 0, W, H);
    // Draw stage background as atmosphere behind the DOM title overlay
    const bg = BACKGROUNDS[0];
    if (bg && bg.complete) ctx.drawImage(bg, 0, 0, W, H);
}

// Note 67: gameLoop is called by requestAnimationFrame, which passes a high-precision
// timestamp 'ts' in milliseconds. Subtracting the previous timestamp gives the elapsed
// time since the last frame (delta time, or 'dt'). Dividing by 1000 converts to seconds
// so all physics and timer values are expressed in seconds, not milliseconds.
// Math.min(..., 0.05) caps dt at 50ms (20 FPS minimum). Without this, a tab that
// was backgrounded and then restored would compute a huge dt and simulate a huge physics
// step — sending entities flying or tunneling through walls.
function gameLoop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (gameState === 'title') {
        drawTitle();
    } else if (gameState === 'viewer') {
        drawSpriteViewer();
        if (JustPressed['Escape']) {
            gameState = 'title';
            document.getElementById('debug-left-panel').classList.add('hidden');
            document.getElementById('title-screen').classList.remove('hidden');
        }
    } else if (gameState === 'playing') {
        update(dt);
        draw();
    } else if (gameState === 'paused') {
        draw(); // keep canvas alive, no logic update
    } else {
        draw(); // stageclear / gameover / victory
        if (JustPressed['Enter']) {
            if (gameState === 'stageclear' && !debugMode) {
                advanceStage();
            } else if (debugMode) {
                initDebugArena();
            } else {
                newGame();
            }
        }
    }

    // Note 68: clearJustPressed must run AFTER all game logic for the frame, so that
    // JustPressed values are visible to everything that needs them this frame, then
    // wiped before the next frame begins. Moving it earlier would cause missed inputs.
    clearJustPressed();
    // Note 69: requestAnimationFrame schedules the next call to gameLoop for the next
    // browser paint (typically ~16.7ms / 60 FPS on a 60Hz display). This is more
    // efficient than setInterval because the browser can pause it when the tab is hidden
    // and it synchronizes with the display refresh rate to avoid tearing.
    requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
// Note 70: The 'load' event fires after the entire page (HTML, CSS, images) has loaded.
// Starting the game here guarantees that all asset Image objects from assets.js have
// at least started loading before the first frame runs. newGame() sets up all initial
// state; then requestAnimationFrame kicks off the loop. The loop is self-perpetuating —
// each call to gameLoop schedules the next one at the very end (Note 69).
window.addEventListener('load', async () => {
    // Merge saved configuration.json values into CFG before anything runs.
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'configuration.json', false);
        xhr.send();
        if (xhr.responseText) Object.assign(CFG, JSON.parse(xhr.responseText));
    } catch(e) { /* file missing or invalid JSON — use built-in defaults */ }

    // Load per-character per-state scale overrides from characters.json.
    // Each key is a charKey ('__player__' or ENEMY_CHARS key); value is an object
    // of { stateKey: { sx, sy } } pairs exported from the Sprite Viewer.
    try {
        const xhr2 = new XMLHttpRequest();
        xhr2.open('GET', 'characters.json', false);
        xhr2.send();
        if (xhr2.responseText) {
            const loaded = JSON.parse(xhr2.responseText);
            for (const [charKey, states] of Object.entries(loaded)) {
                charScales[charKey] = Object.assign(charScales[charKey] || {}, states);
            }
        }
    } catch(e) { /* file missing — all scales default to 1.0 */ }

    // Wait until every SVG sprite has fully decoded. ASSETS_READY is defined at
    // the bottom of assets.js and collects img.decode() promises from loadSvgFile.
    // Without this, ctx.drawImage() silently draws nothing on the first frame.
    await ASSETS_READY;

    // All sprites ready — hide loading screen and hand off to the title screen.
    document.getElementById('loading-screen').style.display = 'none';

    document.getElementById('btn-game').addEventListener('click',   () => startGame(false));
    document.getElementById('btn-debug').addEventListener('click',  () => startGame(true));
    document.getElementById('btn-viewer').addEventListener('click', () => startViewer());
    pauseBtn.addEventListener('click', togglePause);
    requestAnimationFrame(gameLoop);
});

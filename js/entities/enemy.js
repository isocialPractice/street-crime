// js/entities/enemy.js — Enemy definitions table and Enemy class
// ENEMY_DEFS is a data-driven lookup table; Enemy reads from it at spawn time.
// To add a new enemy: add an entry here, create the SVG in assets/, add a matching
// entry to config/enemy-assets.json, and place it in a STAGES wave.

// ── Enemy definitions ─────────────────────────────────────────────────────────
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

// How long an enemy holds its walk cycle after it stops moving before settling
// into its idle pose. _approach() returns exactly 0 inside its deadzone and the
// AI re-decides between walking and standing every frame, so an enemy parked on
// a deadzone, on enemyCloseEnough, or on the radius that counts it as a rusher
// used to flip state on every frame. Every flip rewound animT, which pinned the
// walk to its opening pose and strobed the idle sprite against it. Riding out a
// flicker this short costs nothing, and an enemy that has genuinely stopped
// still stands within a sixth of a second.
const ENEMY_IDLE_SETTLE = 0.15;

// Animation each attack stage swings. The first stage is the plain attack and
// every later one the power attack, which is the escalation SassyGirl already
// used; a stage past the end of this list reuses the last, so a longer
// attackType list keeps escalating for as long as there is artwork for it.
const ENEMY_ATTACK_STAGE_STATES = ['attack', 'powerAttack'];

function _enemyAnimationState(charKey, stateKey, visited = new Set()) {
    const animDef = ENEMY_CHARS[charKey]?.animations?.[stateKey];
    if (!animDef || visited.has(stateKey)) return null;

    const readyFrames = (animDef.frames || []).filter(img => img && img.naturalWidth > 0);
    if (readyFrames.length) {
        return { mode: animDef.mode, frames: readyFrames };
    }
    if (animDef.fallbackState) {
        visited.add(stateKey);
        return _enemyAnimationState(charKey, animDef.fallbackState, visited);
    }
    return null;
}

function _enemyHasDirectFrames(charKey, stateKey) {
    const frames = ENEMY_CHARS[charKey]?.animations?.[stateKey]?.frames || [];
    return frames.some(img => img && img.naturalWidth > 0);
}

function _enemyReferenceFrame(charKey) {
    return _enemyPickFrame(charKey, 'idle', 0) ||
        _enemyPickFrame(charKey, 'walk', 0, { fps: 1 }) ||
        _enemyPickFrame(charKey, 'attack', 0, { duration: CFG.enemyAttackDuration }) ||
        null;
}

// Pixels per authored SVG unit, one value per character, resolved lazily once
// the reference frame has decoded.
const _enemyUnitPxCache = Object.create(null);

// _enemyUnitPx - the scale that turns a frame's authored viewBox units into
// screen pixels, measured once per character from its reference frame.
//
// The measurement itself is svgUnitPx (js/sprites/loader.js), shared with the
// player: the browser sizes a viewBox-only sprite by its shape rather than by
// what was drawn, so a collapse looked like the character growing into a giant
// and standing back up shrank it again. Taking the factor from the reference
// frame keeps the standing poses the game is tuned around at the exact size
// they had and draws every other frame in proportion to them.
function _enemyUnitPx(charKey) {
    const cached = _enemyUnitPxCache[charKey];
    if (cached) return cached;
    const unitPx = svgUnitPx(_enemyReferenceFrame(charKey));
    if (unitPx > 0) _enemyUnitPxCache[charKey] = unitPx;
    return unitPx;
}

const _enemyPowerReachCache = Object.create(null);

// _enemyPowerReach - how far a power attack reaches, in px.
//
// The reach is a property of the artwork rather than something to tune: the
// fully extended frame is the widest one, and its drawn width is the distance
// the swing covers. The widest frame is used rather than the last one because a
// power attack authored as a ping-pong loop ends back on its retracted pose,
// which would understate the reach by half.
function _enemyPowerReach(charKey, stateKey = 'powerAttack') {
    const cacheKey = `${charKey}/${stateKey}`;
    const cached = _enemyPowerReachCache[cacheKey];
    if (cached) return cached;
    const frames = ENEMY_CHARS[charKey]?.animations?.[stateKey]?.frames || [];
    let reach = 0;
    for (const img of frames) {
        // Undecoded frames would measure short, so the answer is left uncached
        // and asked for again on a later frame.
        if (!img || !img.naturalWidth) return 0;
        reach = Math.max(reach, _enemyDrawSize(charKey, img).w);
    }
    if (reach > 0) _enemyPowerReachCache[cacheKey] = reach;
    return reach;
}

// _enemyDrawSize - on-screen size for one frame, in proportion to every other
// frame of the same character.
function _enemyDrawSize(charKey, img) {
    return svgDrawSize(img, _enemyUnitPx(charKey));
}

const _enemyAnchorPxCache = Object.create(null);

// _enemyAnchorPx - px from the centre line back to the rear edge of the
// character's reference pose, which is where an armed frame's back edge is
// held. 0 until the reference has decoded.
function _enemyAnchorPx(charKey) {
    const cached = _enemyAnchorPxCache[charKey];
    if (cached) return cached;
    const ref = _enemyReferenceFrame(charKey);
    const unitPx = _enemyUnitPx(charKey);
    if (!(unitPx > 0) || !(ref?.authoredW > 0)) return 0;
    return (_enemyAnchorPxCache[charKey] = ref.authoredW * unitPx / 2);
}

// _enemyDrawLeft - where a frame's left edge goes, in px from the centre line,
// before the facing flip.
//
// Frames are centred, except those of an armed animation, which carry
// anchorBackX and are placed by their back edge instead, so the body holds
// still while the weapon reaches out. The flip that follows mirrors around the
// same line, which is what keeps the right edge fixed on an enemy facing left.
// See "Weapon anchoring" in js/sprites/enemies.js.
function _enemyDrawLeft(charKey, img, dw) {
    if (typeof img.anchorBackX !== 'number') return -dw / 2;
    const anchorPx = _enemyAnchorPx(charKey);
    if (!anchorPx) return -dw / 2;
    return -anchorPx - img.anchorBackX * _enemyUnitPx(charKey);
}

// _enemySequenceFrame - the frame a run of poses is showing at animT, holding
// the last one once the run is over.
function _enemySequenceFrame(frames, animT, duration, holdTail) {
    if (duration <= 0) return frames[frames.length - 1];
    const activeDuration = Math.max(0.001, duration - holdTail);
    if (animT >= activeDuration) return frames[frames.length - 1];
    const index = Math.min(frames.length - 1, Math.floor((animT / activeDuration) * frames.length));
    return frames[index];
}

function _enemyPickFrame(charKey, stateKey, animT, { fps = 0, duration = 0, holdTail = 0 } = {}) {
    const anim = _enemyAnimationState(charKey, stateKey);
    const frames = anim?.frames || [];
    if (!frames.length) return null;
    if (frames.length === 1) return frames[0];

    switch (anim.mode) {
        case 'loop': {
            // A loop with an explicit rate cycles at that rate. One given only a
            // duration plays through exactly once across it, which is what an
            // attack authored as a loop needs; without this it sat on frame one
            // for the whole swing because no caller passes an attack an fps.
            const rate = fps > 0 ? fps : (duration > 0 ? frames.length / duration : 0);
            return rate > 0 ? frames[Math.floor(animT * rate) % frames.length] : frames[0];
        }
        case 'sequence':
            return _enemySequenceFrame(frames, animT, duration, holdTail);
        default:
            // 'hold' keeps one pose, which is right for the single-frame states
            // it was meant for. A multi-frame hold given a duration plays
            // through and then holds its final frame instead: authoring a
            // collapse or a death run as a hold is a natural thing to write, and
            // it used to freeze the whole animation on its first frame.
            return duration > 0
                ? _enemySequenceFrame(frames, animT, duration, holdTail)
                : frames[0];
    }
}

// ── Enemy class ───────────────────────────────────────────────────────────────
// AI is a multi-phase state machine:
//   engageDelay > 0  — enemy flanks/circles the player before committing to rush
//   dist > closeEnough — rushing toward the player
//   dist <= closeEnough — attacking the player if depth-aligned
class Enemy extends Entity {
    constructor(x, y, typeId) {
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
        // Time since this enemy last had any velocity. See _walkOrIdle.
        this.stillT    = 0;
        this.engageDelay = CFG.enemyEngageDelayMin + Math.random() * CFG.enemyEngageDelayMax;
        this.flankDir    = Math.random() < 0.5 ? 1 : -1;
        this.depthSlot   = (Math.random() - 0.5) * 80;
        // Pending strike: { t, facing } while an attack swing is in flight.
        // Counted down with dt (not setTimeout) so pausing pauses the swing
        // and getting hit out of the attack cancels the damage.
        this.strike      = null;
        // Get-ups: how many times a lethal blow only knocks this enemy down
        // instead of finishing it. Weapon carriers get one by default; see the
        // attackTypeDefaults block in config/enemy-assets.json.
        this.getUps      = ENEMY_CHARS[def.img]?.getUps || 0;
        this.getUpsLeft  = this.getUps;
    }

    // A body lasts for the whole defeat outro: the animation, the held blink,
    // then the fade. Waves wait on this, so all three phases count.
    get defeatLifetime() {
        return CFG.defeatFadeDelay + CFG.defeatBlinkTime + CFG.defeatFadeTime;
    }

    get isDone()  { return this.dead && this.deadT > this.defeatLifetime; }

    // _defeatFade - 1 while the body is fully present, ramping to 0 across the
    // closing defeatFadeTime. Drives the shadow as well as the sprite so the
    // two leave together instead of the shadow popping out on its own.
    _defeatFade() {
        const fadeStart = CFG.defeatFadeDelay + CFG.defeatBlinkTime;
        if (this.deadT < fadeStart) return 1;
        const t = (this.deadT - fadeStart) / Math.max(0.001, CFG.defeatFadeTime);
        return Math.max(0, 1 - t);
    }

    // _defeatBlink - the flicker applied to the sprite once the defeat
    // animation has finished and its final frame is being held. The shadow is
    // deliberately left out of it: a blinking shadow reads as a rendering fault
    // rather than a body winking out.
    _defeatBlink() {
        const t = this.deadT - CFG.defeatFadeDelay;
        if (t < 0 || t >= CFG.defeatBlinkTime) return 1;
        return Math.floor(t * CFG.defeatBlinkFPS) % 2 === 0 ? CFG.defeatBlinkAlpha : 1;
    }

    // _approach — steering velocity toward a target offset. Speed ramps up
    // from zero at the deadzone edge (full speed ~30px past it) instead of
    // switching between full speed and a dead stop, which made enemies twitch
    // back and forth around their goal position.
    _approach(delta, deadzone, maxSpeed) {
        const dist = Math.abs(delta) - deadzone;
        if (dist <= 0) return 0;
        return Math.sign(delta) * Math.min(maxSpeed, dist * 4);
    }

    // _walkOrIdle - pick this frame's locomotion pose from the velocity the AI
    // has just set.
    //
    // Standing still is a question of speed, not of movement being exactly
    // zero. _approach() ramps down to nothing as it closes on its target, so an
    // enemy settling onto a deadzone spends its last moments creeping a few
    // pixels a second: real movement by the arithmetic, none at all to look at,
    // and enough to keep a walk cycle turning under a character that has to all
    // appearances stopped. Anything slower than enemyWalkMinSpeed is treated as
    // standing.
    //
    // Two guards keep the pair from flickering against each other. The walk is
    // held for ENEMY_IDLE_SETTLE past the last real movement, so a one-frame
    // stall never reaches the idle pose at all, and animT is carried across the
    // swap, so a walk that does get interrupted resumes its cycle where it left
    // off rather than restarting.
    //
    // Callers keep their own guard against interrupting an attack, and decide
    // separately whether to step the enemy; this only chooses the pose.
    _walkOrIdle(dt) {
        const moving = Math.hypot(this.vx, this.vy) >= CFG.enemyWalkMinSpeed;
        if (moving) this.stillT = 0;
        else        this.stillT += dt;

        const next = (moving || this.stillT < ENEMY_IDLE_SETTLE) ? 'walk' : 'idle';
        if (this.state === next) return;
        const carried = this.animT;
        this.setState(next);
        if (next === 'walk') this.animT = carried;
    }

    // _startAttack — enter the attack state and arm the pending strike.
    // The damage check itself runs later in _updateStrike, after the wind-up
    // delay, against the LIVE player position at the moment of impact.
    _startAttack(cooldown) {
        this.setState('attack', this._attackDuration());
        this.atkCD  = cooldown + Math.random();
        // Reach is captured with the swing, alongside facing, so the hit is
        // judged by the attack that was actually thrown.
        this.strike = { t: this._attackHitDelay(), facing: this.facing, range: this.attackRange };
    }

    // _attackFrameTime - seconds this enemy's attack frames take to play.
    //
    // The shared enemyAttackDuration is tuned for the short sequences most
    // characters have, and the last frame of any of them is held for
    // enemyAttackFrameHold on top, so the frames themselves get the difference.
    // An enemy that declares "attackTime" in config/enemy-assets.json sets that
    // window itself, which is what a long run such as HyJungScout's fourteen
    // frame draw and lunge needs to be readable at all.
    _attackFrameTime() {
        const declared = ENEMY_CHARS[this.def.img]?.attackTime || 0;
        return declared > 0 ? declared : this._sharedAttackFrameTime();
    }

    _sharedAttackFrameTime() {
        return Math.max(0.001, CFG.enemyAttackDuration - CFG.enemyAttackFrameHold);
    }

    // The swing runs for as long as its frames take, plus the tail hold that
    // leaves the final pose on screen. An enemy on the shared pacing therefore
    // lands back on exactly enemyAttackDuration.
    _attackDuration() {
        return this._attackFrameTime() + CFG.enemyAttackFrameHold;
    }

    // _attackHitDelay - seconds from the start of the swing to the blow landing.
    //
    // enemyAtkHitDelay is one number for every character, so it only means
    // anything as a position within the sequence: at the shared pacing it picks
    // out the frame the artwork connects on. Stretching an enemy's frames
    // stretches the delay by the same factor, so the blow keeps landing on that
    // frame instead of sliding back into the wind-up.
    _attackHitDelay() {
        const scale = this._attackFrameTime() / this._sharedAttackFrameTime();
        return (CFG.enemyAtkHitDelay / 1000) * scale;
    }

    // _appliedPlayerAnims - player animations this enemy's hits swap in, keyed by
    // the player state each one replaces. Declared with an "apply<State>"
    // property in config/enemy-assets.json.
    _appliedPlayerAnims() {
        const applied = ENEMY_CHARS[this.def.img]?.appliedPlayerAnims;
        return (applied && Object.keys(applied).length) ? applied : null;
    }

    // _powerReach - the distance this enemy's power attack covers, or 0 when it
    // is not swinging one.
    _powerReach() {
        return this._isSwingingPowerAttack() ? _enemyPowerReach(this.def.img, this._attackStateKey()) : 0;
    }

    // attackRange - how far a landing blow can connect. A power attack reaches
    // as far as its widest frame is drawn; everything else keeps the tuned
    // baseline, and the baseline is a floor so reach never shrinks.
    get attackRange() {
        return Math.max(CFG.enemyAtkCheckDist, this._powerReach());
    }

    // _updateStrike — count the armed swing down in game time and apply damage
    // when it lands. Replaces the old setTimeout approach, which kept running
    // through pause and judged the hit from stale snapshot positions.
    _updateStrike(dt, player) {
        if (!this.strike) return;
        this.strike.t -= dt;
        if (this.strike.t > 0) return;
        const facing = this.strike.facing;
        const range  = this.strike.range || CFG.enemyAtkCheckDist;
        this.strike  = null;
        if (this.dead || player.dead || player.defeated || player.invT > 0) return;
        const pdx = Math.abs(player.x - this.x);
        const pdy = Math.abs((player.y + player.h) - (this.y + this.h));
        if (pdx < range && pdy < CFG.enemyAtkDepthTol)
            player.takeDamage(Math.round(this.def.dmg * CFG.enemyDmgMultiplier), facing,
                              0, this._powerAttackEffect(), this._appliedPlayerAnims());
    }

    // _attackStage - how many times this enemy has stood back up, which is also
    // which of its attacks it is fighting with.
    //
    // The count is the bound: an enemy with a list of attack types gets one
    // get-up per escalation, and one that declares get-ups without a list still
    // escalates from its attack to its power attack the way SassyGirl always
    // has. What artwork exists for a given stage is _attackStateKey's problem.
    _attackStage() {
        return Math.max(0, this.getUps - this.getUpsLeft);
    }

    // _attackStateKey - the animation this enemy's current stage swings.
    _attackStateKey() {
        const stage = this._attackStage();
        return ENEMY_ATTACK_STAGE_STATES[Math.min(stage, ENEMY_ATTACK_STAGE_STATES.length - 1)];
    }

    // _isSwingingPowerAttack - true while this enemy's attack is the heavier
    // variant it earns by getting back up.
    _isSwingingPowerAttack() {
        const stateKey = this._attackStateKey();
        return stateKey !== ENEMY_ATTACK_STAGE_STATES[0]
            && _enemyHasDirectFrames(this.def.img, stateKey);
    }

    // _powerAttackEffect - the reaction a landing blow should have on the
    // player, or null for an ordinary hit.
    //
    // Declaring powerAttackEffect arms the reaction on every connecting attack,
    // which is what lets an enemy with no power attack, no weapon attack and no
    // get-up assets use one. An enemy that is genuinely swinging its power
    // attack gets the default reaction even with nothing declared.
    _powerAttackEffect() {
        const effect = ENEMY_CHARS[this.def.img]?.powerAttackEffect;
        if (effect && effect.declared) return effect;
        if (!this._isSwingingPowerAttack()) return null;
        return { declared: false, modes: [ENEMY_DEFAULT_REACTION], params: effect?.params || {} };
    }

    update(dt, player, allEnemies = []) {
        this.stepState(dt);
        this.applyGravity(dt);
        const preX = this.x;
        if (this.dead) { this.deadT += dt; return; }
        if (this.atkCD > 0) this.atkCD -= dt;
        this._updateStrike(dt, player);

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
        if (this.state === 'taunt') { return; }
        if (this.state === 'hurt')  { return; }
        if (this.state === 'knockedUp') { return; }

        // ── Active AI ─────────────────────────────────────────────────────────
        if (player.hp <= 0) return;
        const dx   = player.x - this.x;
        const dy   = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const stageData = (typeof getCurrentStageData === 'function') ? getCurrentStageData() : null;
        this.facing = dx > 0 ? 1 : -1;

        // A power attack reaches as far as its widest frame is drawn, so an
        // enemy carrying one stops and swings from there instead of closing to
        // punching range first.
        const closeEnough = Math.max(
            (this.def.boss || this.def.mini) ? 95 : CFG.enemyCloseEnough,
            this._powerReach());

        // ── Engage delay: flank slowly until ready to rush ────────────────────
        if (this.engageDelay > 0) {
            this.engageDelay -= dt;
            // Static attack — a waiting enemy is not a harmless statue. If the
            // player walks into range while it is flanking, it swings from its
            // standing position instead of waiting for the rush phase.
            const feetDy = Math.abs((player.y + player.h) - (this.y + this.h));
            if (this.state !== 'attack' && this.atkCD <= 0 &&
                dist <= Math.max(CFG.enemyStaticAtkRange, this._powerReach()) &&
                feetDy < CFG.enemyAtkDepthTol) {
                this.vx = 0; this.vy = 0;
                this._startAttack(CFG.enemyStaticAtkCooldown);
                return;
            }
            const flankTarget = projectStageEntityPosition(stageData,
                player.x + this.flankDir * (CFG.enemyFlankRadius + 45 * Math.sin(this.animT * 0.8)),
                player.y + this.depthSlot,
                this.w,
                this.h,
                this.x,
                this.y);
            const flankX = flankTarget.x;
            const flankY = flankTarget.y;
            const fdx    = flankX - this.x;
            const fdy    = flankY - this.y;
            const flankSpd = this.speed * CFG.enemySpeedMultiplier * CFG.enemyFlankSpeed;
            this.vx = this._approach(fdx, 50, flankSpd);
            this.vy = this._approach(fdy, 20, flankSpd * 0.875);
            this.facing = dx > 0 ? 1 : -1;
            if (this.state === 'attack') {
                // Don't interrupt attack animation while re-engaging
            } else {
                this._walkOrIdle(dt);
                if (this.vx !== 0 || this.vy !== 0) this.moveXY(dt);
            }
            if (cam.x > 0) this.x = Math.max(cam.x - 250, this.x);
            return;
        }

        // ── Count active rushers — limit crowd-rushing ────────────────────────
        const maxSimul = this.def.boss ? 4 : this.def.mini ? 2 : 1;
        const activeRushers = allEnemies.filter(e =>
            e !== this && !e.dead && e.engageDelay <= 0 &&
            Math.hypot(player.x - e.x, player.y - e.y) <= closeEnough + 90
        ).length;

        if (dist > closeEnough) {
            if (activeRushers < maxSimul) {
                const rushSpd = this.speed * CFG.enemySpeedMultiplier;
                this.vx = this._approach(dx, 20, rushSpd);
                this.vy = this._approach(dy, 12, rushSpd * 0.5);
                if (this.state !== 'attack') {
                    this._walkOrIdle(dt);
                    this.moveXY(dt);
                }
            } else {
                const holdX    = player.x + this.flankDir * (closeEnough + 100);
                const hdx      = holdX - this.x;
                const holdSpd  = this.speed * CFG.enemySpeedMultiplier;
                this.vx = this._approach(hdx, 35, holdSpd * 0.28);
                this.vy = this._approach(dy,  22, holdSpd * 0.22);
                if (this.state !== 'attack') {
                    this._walkOrIdle(dt);
                    if (this.vx !== 0 || this.vy !== 0) this.moveXY(dt);
                }
            }
        } else {
            this.vx = 0; this.vy = 0;
            if (this.state !== 'attack') this._walkOrIdle(dt);

            const feet_dy = (player.y + player.h) - (this.y + this.h);
            if (this.atkCD <= 0 && Math.abs(feet_dy) < 50) {
                this._startAttack(this.def.boss ? 1.1 : this.def.mini ? 1.5 : CFG.enemyAtkCooldown);
                this.engageDelay = CFG.enemyReengageMin + Math.random() * CFG.enemyReengageRange;
            }
        }

        if (cam.x > 0) this.x = Math.max(cam.x - 250, this.x);
        this._separate(allEnemies, dt);
    }

    // Resolve overlap with other enemies by nudging positions apart.
    // The nudge is capped to enemySeparationSpeed px/s (scaled by dt like all
    // other movement) so deep overlaps slide apart over a few frames instead
    // of teleporting half the deficit in a single frame.
    _separate(allEnemies, dt) {
        const maxStep = CFG.enemySeparationSpeed * dt;
        for (const other of allEnemies) {
            if (other === this || other.dead) continue;
            const cx = (this.x + this.w * 0.5) - (other.x + other.w * 0.5);
            const cy = (this.y + this.h * 0.5) - (other.y + other.h * 0.5);
            const minX = this.w * 0.5 + other.w * 0.5 + 4;
            const minY = this.h * 0.4 + other.h * 0.4;
            if (Math.abs(cx) < minX && Math.abs(cy) < minY) {
                // Push out along the axis of least penetration so the nudge
                // takes the shortest path instead of shoving on both axes.
                const depthX = minX - Math.abs(cx);
                const depthY = minY - Math.abs(cy);
                let pushX = 0, pushY = 0;
                if (depthX <= depthY) {
                    pushX = Math.min(depthX * 0.5, maxStep) * Math.sign(cx || 1);
                } else {
                    pushY = Math.min(depthY * 0.5, maxStep) * Math.sign(cy || 1);
                }
                const prevX = this.x;
                const prevY = this.y;
                this.x += pushX;
                this.y += pushY;
                this.clampToStageField(prevX, prevY);
            }
        }
    }

    _onStateEnd() {
        if (this.state === 'getup') {
            this.invincible  = false;
            this.engageDelay = CFG.enemyGetupReengageMin + Math.random();
            // Conditional follow-on: an enemy that maps a taunt animation gloats
            // before rejoining the fight. One with no taunt goes straight back
            // to idle, so nothing follows for the rest of the roster.
            if (_enemyHasDirectFrames(this.def.img, 'taunt')) {
                this.setState('taunt', CFG.enemyTauntTime);
                return;
            }
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
        if (debugMode && CFG.infiniteEnemyHealth) return;
        // Being hit interrupts any swing already in flight.
        this.strike = null;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            if (this.getUpsLeft > 0) { this._beginGetUp(); return; }
            this._die();
            return;
        }
        const prevX = this.x;
        if (launch > 0) {
            this.vz = launch;
            this.x += dir * CFG.enemyLaunchKnockbackDist;
            this.clampToStageField(prevX, this.y);
            this.setState('knockedUp');
            this.invincible = true;
        } else {
            this.x += dir * CFG.enemyKnockbackDist;
            this.clampToStageField(prevX, this.y);
            this._beginHurt();
        }
    }

    // _beginHurt - enter the flinch, or extend one already running.
    //
    // setState() rewinds animT, so every blow used to restart the damage run
    // from its opening pose. A combo lands faster than the run plays, which
    // meant the enemy never got past the first hunch however many frames its
    // reaction was drawn with. A blow arriving mid-flinch now only pushes the
    // timer out: one run plays across the whole combo, and _enemySequenceFrame
    // holds its final pose once the frames are spent, so the reaction ends on
    // the last hit instead of snapping back to the start of the flinch.
    _beginHurt() {
        if (this.state === 'hurt') { this.stTimer = CFG.enemyHurtTime; return; }
        this.setState('hurt', CFG.enemyHurtTime);
    }

    // _beginGetUp - survive a lethal blow and go down instead of out.
    // The enemy drops into the ordinary knockdown state, so the existing
    // knockdown > getup > idle chain plays preDefeat and then getUp before it
    // rejoins the fight. It stays invincible for the whole recovery, otherwise
    // a player standing over it would chain-hit the revive into nothing.
    _beginGetUp() {
        this.getUpsLeft--;
        this.hp          = Math.max(1, Math.round(this.maxHp * CFG.enemyGetUpHealthFactor));
        this.strike      = null;
        this.vz          = 0;
        this.setState('knockdown');
        this.downT       = CFG.enemyGetUpDownTime;
        this.invincible  = true;
    }

    _die() {
        this.dead    = true;
        this.deadT   = 0;
        this.animT   = 0;
        this.state   = 'dead';
        this.stTimer = 0;
        addScore(this.def.pts);
    }

    getImg() {
        const charKey = this.def.img;
        const idleImg = _enemyPickFrame(charKey, 'idle', this.animT, { fps: CFG.enemyIdleFPS });
        if (!idleImg) return null;

        switch (this.state) {
            case 'walk':
                return _enemyPickFrame(charKey, 'walk', this.animT, { fps: CFG.enemyWalkFPS }) || idleImg;
            case 'attack':
                // powerAttack falls back to 'attack' when a character has no
                // power frames of its own, so this is safe for every enemy.
                return _enemyPickFrame(charKey, this._attackStateKey(), this.animT, {
                    duration: this._attackDuration(),
                    holdTail: CFG.enemyAttackFrameHold,
                }) || idleImg;
            case 'hurt':
                return _enemyPickFrame(charKey, 'damage', this.animT, { duration: CFG.enemyHurtTime }) || idleImg;
            case 'knockedUp':
                // Airborne, so the collapse is held on its opening pose. A
                // character folding up in mid-air reads as a glitch; the fall
                // itself is the animation here. animT of 0 pins frame one
                // whatever mode the state uses.
                return _enemyPickFrame(charKey, 'preDefeat', 0, { duration: CFG.enemyPreDefeatTime }) ||
                    _enemyPickFrame(charKey, 'damage', this.animT, { duration: CFG.enemyHurtTime }) ||
                    idleImg;
            case 'knockdown':
                // On the ground the collapse plays once over enemyPreDefeatTime
                // and then holds its final downed pose, since a 'sequence' past
                // its duration stays on the last frame. Without a duration the
                // whole knockdown sat on a single frame, which read as a long
                // pause and then a jump straight to the much wider lying pose.
                return _enemyPickFrame(charKey, 'preDefeat', this.animT, { duration: CFG.enemyPreDefeatTime }) ||
                    _enemyPickFrame(charKey, 'damage', this.animT, { duration: CFG.enemyHurtTime }) ||
                    idleImg;
            case 'getup':
                return _enemyPickFrame(charKey, 'getUp', this.animT, { duration: CFG.enemyGetupTime }) ||
                    _enemyPickFrame(charKey, 'preDefeat', this.animT) || idleImg;
            case 'taunt':
                return _enemyPickFrame(charKey, 'taunt', this.animT, { duration: CFG.enemyTauntTime }) || idleImg;
            case 'dead':
                return _enemyPickFrame(charKey, 'defeat', this.deadT, { duration: CFG.defeatFadeDelay }) || idleImg;
            default:
                return idleImg;
        }
    }

    draw() {
        if (this.isDone) return;

        const fade = this.dead ? this._defeatFade() : 1;
        if (fade <= 0) return;
        this.drawShadow(fade);

        const img = this.getImg();
        if (!img || img.naturalWidth === 0) return;

        const flash = this.state === 'hurt' && Math.floor(this.animT * CFG.enemyHurtFlashFPS) % 2 === 0;
        const size = _enemyDrawSize(this.def.img, img);
        const dw = size.w || this.w;
        const dh = size.h || this.h;

        ctx.save();
        if (this.dead)  ctx.globalAlpha = fade * this._defeatBlink();
        else if (flash) ctx.globalAlpha = CFG.hitFlashAlpha;
        ctx.translate(this.screenX + this.w / 2, this.drawY + this.h);

        const useRotateDeath = !_enemyHasDirectFrames(this.def.img, 'defeat') && this.dead;

        if (this.dead) {
            // Frames are already in proportion, so the only scaling left here is
            // the authored defeat pose tuning in CFG.
            const defRad = CFG.defeatRotation * Math.PI / 180;
            if (useRotateDeath) {
                ctx.rotate(-Math.PI / 2 + defRad);
                ctx.translate(CFG.defeatOffsetX + dh * 0.5, -CFG.defeatOffsetY + dw * 0.1);
            } else {
                ctx.rotate(defRad);
                ctx.translate(CFG.defeatOffsetX * this.facing, -CFG.defeatOffsetY);
            }
            ctx.scale(this.facing * CFG.defeatScaleX, CFG.defeatScaleY);
        } else {
            ctx.scale(this.facing, 1);
            if (this.state === 'attack' && !_enemyHasDirectFrames(this.def.img, 'attack')) {
                const maxAngle = Math.PI / 18;
                if (this.animT < 0.5) {
                    ctx.rotate(maxAngle);
                } else {
                    const t = Math.min(1, (this.animT - 0.5) / 0.3);
                    ctx.rotate(maxAngle * (1 - t));
                }
            }
        }
        ctx.drawImage(img, _enemyDrawLeft(this.def.img, img, dw), -dh, dw, dh);
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

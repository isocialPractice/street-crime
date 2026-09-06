// js/entities/player.js — Player class
// Extends Entity; handles input-driven movement, attack logic, hit response,
// sprite animation, and drawing. Reads from PLAYER (js/sprites/player.js),
// CFG (js/core/config.js), Keys/JustPressed (js/core/input.js).

class Player extends Entity {
    constructor(x, y) {
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
        // ── Stamina (gates run-kick) ──────────────────────────────────────
        // stamina is normalised 0..1 (1 = full, 0 = empty).
        // stamCD counts down the post-use delay before recharging starts.
        // rechargeCountLevel/Game count completed refill cycles for the
        // per-level / per-game limit toggles in CFG.
        this.stamina           = 1;
        this.stamCD            = 0;
        this.rechargeCountLevel = 0;
        this.rechargeCountGame  = 0;
        // ── Input buffers (seconds remaining) ─────────────────────────────
        // A press made while busy or on cooldown is remembered for
        // CFG.inputBufferTime and fires as soon as the player is free, so
        // rapid combo inputs are never dropped between animations.
        this.bufPunch = 0;
        this.bufKick  = 0;
        this.bufJump  = 0;
        // Power attack freeze: while this is running, movement and key presses
        // are ignored and the player blinks. Set by playerFreeze reactions.
        this.freezeT  = 0;
    }

    // frozen is true while a power attack reaction has the player's controls
    // locked out. Kept separate from busy so an attack animation that happens to
    // be running is not confused with an imposed freeze.
    get frozen() { return this.freezeT > 0; }

    // busy is true whenever the player is locked into an animation that should
    // prevent new actions or restrict movement.
    get busy() {
        return ['punch1','punch2','kick1','kick2','uppercut','runningkick','jumpkick',
                'hurt','knockdown','knockedUp'].includes(this.state);
    }

    update(dt, enemies, effects, pickups, breakables) {
        this.stepState(dt);
        this.applyGravity(dt);
        if (this.atkCD > 0) this.atkCD -= dt;
        if (this.invT  > 0) this.invT  -= dt;
        if (this.freezeT > 0) {
            this.freezeT -= dt;
            // Key presses are disabled outright, so nothing queues up during the
            // freeze and fires in a burst the moment it ends.
            this.bufPunch = this.bufKick = this.bufJump = 0;
        }
        if (this.comboT > 0) {
            this.comboT -= dt;
            if (this.comboT <= 0) { this.comboC = 0; _updateComboHUD(0); }
        }

        // ── Input buffering ──────────────────────────────────────────────────
        // Capture presses into short-lived buffers every frame (including while
        // busy or knocked down) so an attack queued during an animation comes
        // out the moment the player is free again.
        if (JustPressed['KeyJ'] || JustPressed['KeyZ']) this.bufPunch = CFG.inputBufferTime;
        if (JustPressed['KeyK'] || JustPressed['KeyX']) this.bufKick  = CFG.inputBufferTime;
        if (JustPressed['Space'])                       this.bufJump  = CFG.inputBufferTime;
        this.bufPunch = Math.max(0, this.bufPunch - dt);
        this.bufKick  = Math.max(0, this.bufKick  - dt);
        this.bufJump  = Math.max(0, this.bufJump  - dt);

        // ── Stamina recharge ─────────────────────────────────────────────────
        // After use the stamina drops to 0 and stamCD is set to staminaDuration.
        // Once the delay elapses, the bar refills linearly over staminaRecharge
        // seconds. If a per-level / per-game recharge limit is active and has
        // been reached, the bar stays empty.
        if (this.stamina < 1) {
            if (this.stamCD > 0) {
                this.stamCD -= dt;
            } else if (!_staminaRechargeBlocked(this)) {
                const rate = 1 / Math.max(0.0001, CFG.staminaRecharge);
                this.stamina = Math.min(1, this.stamina + rate * dt);
                if (this.stamina >= 1) {
                    this.rechargeCountLevel++;
                    this.rechargeCountGame++;
                }
            }
        }
        _staminaHUD(this);

        // Knockdown — wait then stand up
        if (this.state === 'knockdown') {
            this.downT -= dt;
            if (this.downT <= 0) { this.setState('idle'); this.invT = 1.0; }
            return;
        }

        const canMove = !this.frozen && (!this.busy || this.state === 'jump' || this.state === 'jumpkick');
        const canAct  = !this.frozen && !this.busy;
        const preX = this.x;
        const preY = this.y;

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

                // ── Run transition ────────────────────────────────────────
                // wasRun holds last frame's run intent so we can spot the exact
                // frame Shift goes down or up. That edge starts the short
                // transition animation (see _onStateEnd and getImg); holding or
                // releasing Shift on later frames produces no new edge.
                // The transition is cosmetic only: movement is never blocked, so
                // speed still changes on the same frame the key is pressed.
                // Running-kick and jump are already excluded here: both make the
                // player busy or airborne, and this block only runs when grounded
                // and free, so their sprites are never overridden by a transition.
                const moving = this.vx !== 0 || this.vy !== 0;
                const wasRun = this.isRun;          // actually running last frame
                const nowRun = moving && run;       // actually running this frame
                this.isRun = nowRun;
                const inTransition = this.state === 'runstart' || this.state === 'runstop';

                if (nowRun && !wasRun) {
                    this.setState('runstart', CFG.playerTransitionTime);
                } else if (!nowRun && wasRun) {
                    // Covers both releasing Shift while still moving and stopping
                    // dead out of a run, so a run always exits through the same
                    // wind-down frames.
                    this.setState('runstop', CFG.playerTransitionTime);
                } else if (inTransition) {
                    // Let the running transition play out untouched; _onStateEnd
                    // resolves it into run/walk when the timer expires.
                } else if (moving) {
                    const ws = run ? 'run' : 'walk';
                    if (this.state !== ws) this.setState(ws);
                } else if (this.state !== 'idle') {
                    this.setState('idle');
                }
            } else {
                // Air strafe (horizontal only, reduced by air control factor)
                if (left)  { this.vx = -CFG.playerSpeed * CFG.playerAirControl; this.facing = -1; }
                if (right) { this.vx =  CFG.playerSpeed * CFG.playerAirControl; this.facing =  1; }
                else if (!left) this.vx = this.vx * 0.92;
            }

            this.moveXY(dt);
            this.x = Math.max(cam.x, this.x);
            if (levelMgr?.locked) {
                this.x = Math.min(cam.x + W - this.w, this.x);
            }
            this.clampToStageField(preX, preY);
        }

        // ── Body collision: player vs breakable objects ────────────────────────
        // Block only when the player's feet (this.y + this.h) fall inside the
        // object's depth span [obj.y - obj.h … obj.y]. Walking in front of or
        // behind the box passes freely regardless of horizontal position.
        if (this.grounded) {
            for (const obj of breakables) {
                if (obj.broken) continue;
                const feet   = this.y + this.h;
                const expand = CFG.objBlockDepthExpand;
                if (feet <= (obj.y - obj.h) - expand || feet >= obj.y + expand) continue;
                const overlapL = (this.x + this.w) - obj.x;
                const overlapR = (obj.x + obj.w)   - this.x;
                if (overlapL <= 0 || overlapR <= 0) continue;
                const pcx = this.x + this.w * 0.5;
                const bcx = obj.x  + obj.w * 0.5;
                this.x = (pcx < bcx)
                    ? Math.min(preX, obj.x - this.w)
                    : Math.max(preX, obj.x + obj.w);
                this.vx = 0;
            }
        }

        // ── Body collision: player vs enemies ─────────────────────────────────
        // Mirrors the breakable block above but uses the enemy's feet
        // (e.y + e.h) as the depth reference so the player can pass in front
        // of or behind an enemy on the depth axis. Dead/knocked-down enemies
        // do not block movement (you can walk over the body). Skipped while
        // airborne so jumping over enemies still works.
        if (this.grounded) {
            for (const e of enemies) {
                if (e.dead || e.hp <= 0) continue;
                if (e.state === 'knockdown' || e.state === 'knockedUp') continue;
                const expand = CFG.enemyBlockDepthExpand;
                const dy = (this.y + this.h) - (e.y + e.h);
                if (Math.abs(dy) > expand) continue;
                const overlapL = (this.x + this.w) - e.x;
                const overlapR = (e.x + e.w)       - this.x;
                if (overlapL <= 0 || overlapR <= 0) continue;
                const pcx = this.x + this.w * 0.5;
                const ecx = e.x    + e.w * 0.5;
                // Push player back along X to whichever edge they came from.
                this.x = (pcx < ecx)
                    ? Math.min(preX, e.x - this.w)
                    : Math.max(preX, e.x + e.w);
                // Also undo any depth (Y) change that drove us into the band.
                this.y = preY;
                this.vx = 0;
                this.vy = 0;
            }
        }

        // ── Jump ──────────────────────────────────────────────────────────────
        // Reads the jump buffer instead of the raw press so a Space tapped just
        // before landing still jumps on the first grounded frame.
        if (this.bufJump > 0 && this.grounded && canAct) {
            this.bufJump = 0;
            this.vz = CFG.jumpSpeed;
            this.setState('jump');
        }

        // ── Attacks ───────────────────────────────────────────────────────────
        // Buffered presses count as pressed; each attack consumes the buffer(s)
        // that triggered it so one press never fires two moves.
        const jPressed = this.bufPunch > 0;
        const kPressed = this.bufKick  > 0;
        const upHeld   = Keys['ArrowUp'] || Keys['KeyW'];

        if (canAct && this.atkCD <= 0) {
            if (!this.grounded) {
                if (jPressed || kPressed) {
                    this.bufPunch = 0; this.bufKick = 0;
                    this.setState('jumpkick', 0.35);
                    this.atkCD = 0.4;
                    this._doAttack(enemies, effects, 'jumpkick');
                }
            } else if (jPressed && upHeld) {
                this.bufPunch = 0;
                this.setState('uppercut', 0.45);
                this.atkCD = 0.55;
                this._doAttack(enemies, effects, 'uppercut');
            } else if (kPressed && this.isRun && this.stamina >= 1) {
                this.bufKick = 0;
                this.setState('runningkick', 0.45);
                this.atkCD = 0.5;
                this._doAttack(enemies, effects, 'runningkick');
                // Drain the bar fully and start the recharge delay.
                this.stamina = 0;
                this.stamCD  = CFG.staminaDuration;
            } else if (jPressed) {
                this.bufPunch = 0;
                const ph = this.pPhase; this.pPhase ^= 1;
                this.setState(ph === 0 ? 'punch1' : 'punch2', 0.28);
                this.atkCD = 0.32;
                this._doAttack(enemies, effects, 'punch');
            } else if (kPressed) {
                this.bufKick = 0;
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

    // _doAttack — heart of hit detection, called immediately when an attack begins.
    // All attack parameters are data-driven by 'type' so adding a new move only
    // requires new entries in the lookup tables below.
    _doAttack(enemies, effects, type) {
        const RANGE  = { punch:CFG.punchRange, kick:CFG.kickRange, uppercut:CFG.uppercutRange, runningkick:CFG.runningKickRange, jumpkick:CFG.jumpKickRange };
        const DMG    = { punch:CFG.punchDmg,   kick:CFG.kickDmg,   uppercut:CFG.uppercutDmg,   runningkick:CFG.runningKickDmg,   jumpkick:CFG.jumpKickDmg   };
        const LAUNCH = { uppercut: 450, runningkick:0, jumpkick:0, punch:0, kick:0 };
        const FX     = { punch:'small', kick:'medium', uppercut:'hard', runningkick:'medium', jumpkick:'medium' };

        const range  = RANGE[type]  || 70;
        const dmg    = DMG[type]    || 22;
        const launch = LAUNCH[type] || 0;
        const fxType = FX[type]     || 'small';

        const BODY_OVERLAP = CFG.collisionBodyOverlap;
        const DEPTH_TOL    = CFG.collisionDepthTol;
        const front = (this.facing === 1) ? this.x + this.w : this.x;
        const hx1   = (this.facing === 1) ? front - BODY_OVERLAP : front - range;
        const hx2   = (this.facing === 1) ? front + range        : front + BODY_OVERLAP;

        enemies.forEach(e => {
            if (e.dead || e.hp <= 0 || e.invincible) return;
            const xHit = hx2 > e.x && hx1 < e.x + e.w;
            const yHit = Math.abs((e.y + e.h) - (this.y + this.h)) < DEPTH_TOL;
            if (xHit && yHit) {
                e.takeDamage(dmg, this.facing, launch);
                addScore(dmg * 5);

                effects.push(new HitFX(
                    e.x + e.w / 2,
                    e.y - e.h * 0.45 - e.z,
                    fxType
                ));

                this.comboC++;
                this.comboT = CFG.comboTimeout;
                _updateComboHUD(this.comboC);

                screenShake(type === 'uppercut' || type === 'runningkick' ? 7 : 3);
            }
        });
    }

    // _reactionParam - a mode's tuning value for the enemy that landed the blow,
    // falling back to the global default when it declares none of its own.
    _reactionParam(effect, mode, fallback) {
        const value = effect?.params?.[mode];
        return (typeof value === 'number' && isFinite(value)) ? value : fallback;
    }

    // _applyPowerAttackEffect - run the reactions a power attack carries.
    //
    // Order matters. The damage bonus is folded into the hit before it lands, so
    // it is handled by the caller; here the positional and state reactions are
    // applied with knockdown last, because being put on the floor outranks being
    // pushed back. A freeze runs alongside whatever else happened.
    _applyPowerAttackEffect(effect, dir) {
        const modes = effect?.modes || [];

        if (modes.includes('playerKnockBack')) {
            const dist = this._reactionParam(effect, 'playerKnockBack', CFG.powerAttackKnockBackDist);
            const prevX = this.x;
            this.x += dir * dist;
            this.clampToStageField(prevX, this.y);
            // Player_Damage.svg is the mapped damage pose, so the hurt state
            // already shows the right art for a knockback.
            this.setState('hurt', 0.35);
            this.invT = CFG.playerHurtInvTime;
        }

        if (modes.includes('playerKnockDown')) {
            this.setState('knockdown');
            this.downT = CFG.playerKnockdownTime;
            this.invT  = CFG.playerKnockdownTime;
        }

        if (modes.includes('playerFreeze')) {
            const time = this._reactionParam(effect, 'playerFreeze', CFG.powerAttackFreezeTime);
            this.freezeT = Math.max(this.freezeT, time);
        }
    }

    takeDamage(amount, dir, launch = 0, effect = null) {
        if (this.invT > 0 || this.dead) return;
        if (debugMode && CFG.infiniteHealth) return;
        if (effect?.modes?.includes('playerTakesAdditionalDamage')) {
            const bonus = this._reactionParam(effect, 'playerTakesAdditionalDamage',
                                              CFG.powerAttackDamageBonus);
            amount = Math.round(amount * (1 + Math.max(0, bonus)));
        }
        this.hp -= amount;
        screenShake(5);
        effects.push(new HitFX(this.x + this.w / 2, this.y - this.h * 0.4, 'medium'));
        if (this.hp <= 0) { this.hp = 0; this._die(); return; }
        const prevX = this.x;
        if (launch > 0) {
            this.vz = launch * 0.7;
            this.x += dir * 50;
            this.clampToStageField(prevX, this.y);
            this.setState('knockedUp');
        } else {
            this.setState('hurt', 0.35);
            this.invT = CFG.playerHurtInvTime;
        }
        // Reactions run after the ordinary hit response so they can override the
        // state and position it just set.
        if (effect) this._applyPowerAttackEffect(effect, dir);
        _hpHUD(this);
    }

    // A finished run transition resolves into the movement state it was heading
    // toward; every other timed state falls back to idle as before. Runs inside
    // stepState, which is called before the movement block each frame, so if the
    // player has meanwhile stopped moving the block corrects this to idle on the
    // same frame and no stale walk/run frame is ever drawn.
    _onStateEnd() {
        if (this.state === 'runstart') { this.setState('run'); return; }
        if (this.state === 'runstop')  { this.setState(this.isRun ? 'run' : 'walk'); return; }
        this.setState('idle');
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
            const stageData = (typeof getCurrentStageData === 'function') ? getCurrentStageData() : null;
            const spawn = stageHasField(stageData)
                ? sampleStageEntityPosition(stageData, this.w, this.h, {
                    minX: cam.x + 90,
                    maxX: cam.x + 180,
                })
                : null;
            this.hp = this.maxHp;
            this.x  = spawn ? spawn.x : cam.x + 90;
            this.y  = spawn ? spawn.y : 445;
            this.z  = this.vz = 0;
            this.setState('idle');
            this.invT = 2.5;
            _hpHUD(this);
        }
    }

    getImg() {
        const WALK_FRAMES = [PLAYER.walk0,PLAYER.walk1,PLAYER.walk2,PLAYER.walk3,PLAYER.walk4,PLAYER.walk5,PLAYER.walk6,PLAYER.walk7];
        const RUN_FRAMES  = [PLAYER.run0,PLAYER.run1,PLAYER.run2,PLAYER.run3,PLAYER.run4,PLAYER.run5,PLAYER.run6,PLAYER.run7];
        const IDLE_FRAMES = [PLAYER.idle1,PLAYER.idle2,PLAYER.idle3,PLAYER.idle4];
        // TRANS_FRAMES plays forward on 'runstart' and backward on 'runstop'.
        const TRANS_FRAMES = [PLAYER.transition0,PLAYER.transition1,PLAYER.transition2];
        switch (this.state) {
            case 'walk':        return WALK_FRAMES[Math.floor(this.animT * CFG.playerWalkFPS) % 8];
            case 'run':         return RUN_FRAMES[Math.floor(this.animT * CFG.playerRunFPS) % 8] || PLAYER.run;
            case 'runstart':
            case 'runstop': {
                // Spread the 3 frames evenly across playerTransitionTime rather
                // than using a fixed FPS, so retuning the duration in the debug
                // panel always shows the complete sequence and never clips it.
                const dur = Math.max(0.0001, CFG.playerTransitionTime);
                const n   = TRANS_FRAMES.length;
                // Clamp below 1 so animT === dur cannot index off the end on the
                // frame the timer expires.
                const p = Math.min(0.9999, Math.max(0, this.animT / dur));
                const i = Math.floor(p * n);
                return TRANS_FRAMES[this.state === 'runstart' ? i : (n - 1 - i)] || PLAYER.run;
            }
            case 'jump':        return PLAYER.jump;
            case 'jumpkick':    return PLAYER.jumpKick;
            case 'punch1':      return PLAYER.punch1;
            case 'punch2':      return PLAYER.punch2;
            case 'kick1':       return PLAYER.kick1;
            case 'kick2':       return PLAYER.kick2;
            case 'uppercut':    return PLAYER.upperCut;
            case 'runningkick': return PLAYER.runningKick;
            case 'hurt':
            case 'knockedUp':   return PLAYER.knockDown;
            // A dedicated knockdown pose is used when one exists; with neither
            // on disk the damage pose is tipped over procedurally in draw().
            case 'knockdown':   return PLAYER.knockDownPose || PLAYER.preDefeat || PLAYER.knockDown;
            default:            return IDLE_FRAMES[Math.floor(this.animT * CFG.playerIdleFPS) % 4];
        }
    }

    // _knockdownFall - how far over the player has tipped, 0 upright to 1 flat.
    // Used only when there is no dedicated knockdown art. The fall and the rise
    // each take a quarter of the knockdown so the player drops, lies still, then
    // pushes back up rather than snapping between poses.
    _knockdownFall() {
        const total = Math.max(0.001, CFG.playerKnockdownTime);
        const edge  = total * 0.25;
        const down  = Math.max(0, this.downT);
        const elapsed = total - down;
        if (elapsed < edge) return Math.max(0, elapsed / edge);
        if (down < edge)    return Math.max(0, down / edge);
        return 1;
    }

    draw() {
        if (this.invT > 0 && Math.floor(this.invT * CFG.playerInvFlashRate) % 2 === 0) return;
        // A freeze blinks on its own clock, so the player reads as held even
        // once the brief hurt invincibility behind it has run out.
        if (this.frozen && Math.floor(this.freezeT * CFG.playerInvFlashRate) % 2 === 0) return;
        this.drawShadow();
        const img = this.getImg();
        if (!img || img.naturalWidth === 0) return;
        const dw = img.naturalWidth  || this.w;
        const dh = img.naturalHeight || this.h;
        ctx.save();
        ctx.translate(this.screenX + this.w / 2, this.drawY + this.h);
        ctx.scale(this.facing, 1);
        // Smooth knockdown: with no knockdown artwork the damage pose is rotated
        // about the player's feet, which keeps the body on the ground line while
        // it goes down and comes back up.
        const smoothKnockdown = this.state === 'knockdown'
            && !PLAYER.knockDownPose && !PLAYER.preDefeat;
        if (smoothKnockdown) ctx.rotate(-(Math.PI / 2) * this._knockdownFall());
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        ctx.restore();
    }
}

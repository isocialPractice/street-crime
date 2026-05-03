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

const ENEMY_HURT_DURATION = 0.35;

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

function _enemyDefeatScale(charKey, img) {
    const refImg = _enemyReferenceFrame(charKey);
    const refLongSide = Math.max(refImg?.naturalWidth || 0, refImg?.naturalHeight || 0);
    const imgLongSide = Math.max(img?.naturalWidth || 0, img?.naturalHeight || 0);
    if (!refLongSide || !imgLongSide) return 1;
    return refLongSide / imgLongSide;
}

function _enemyPickFrame(charKey, stateKey, animT, { fps = 0, duration = 0, holdTail = 0 } = {}) {
    const anim = _enemyAnimationState(charKey, stateKey);
    const frames = anim?.frames || [];
    if (!frames.length) return null;
    if (frames.length === 1) return frames[0];

    switch (anim.mode) {
        case 'loop':
            return fps > 0 ? frames[Math.floor(animT * fps) % frames.length] : frames[0];
        case 'sequence': {
            if (duration <= 0) return frames[frames.length - 1];
            const activeDuration = Math.max(0.001, duration - holdTail);
            if (animT >= activeDuration) return frames[frames.length - 1];
            const index = Math.min(frames.length - 1, Math.floor((animT / activeDuration) * frames.length));
            return frames[index];
        }
        default:
            return frames[0];
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
        this.engageDelay = CFG.enemyEngageDelayMin + Math.random() * CFG.enemyEngageDelayMax;
        this.flankDir    = Math.random() < 0.5 ? 1 : -1;
        this.depthSlot   = (Math.random() - 0.5) * 80;
    }

    get isDone()  { return this.dead && this.deadT > CFG.defeatFadeDelay; }

    update(dt, player, allEnemies = []) {
        this.stepState(dt);
        this.applyGravity(dt);
        const preX = this.x;
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
        const dx   = player.x - this.x;
        const dy   = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const stageData = (typeof getCurrentStageData === 'function') ? getCurrentStageData() : null;
        this.facing = dx > 0 ? 1 : -1;

        const closeEnough = (this.def.boss || this.def.mini) ? 95 : CFG.enemyCloseEnough;

        // ── Engage delay: flank slowly until ready to rush ────────────────────
        if (this.engageDelay > 0) {
            this.engageDelay -= dt;
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
            this.vx = Math.abs(fdx) > 50 ? Math.sign(fdx) * this.speed * CFG.enemySpeedMultiplier * CFG.enemyFlankSpeed : 0;
            this.vy = Math.abs(fdy) > 20 ? Math.sign(fdy) * this.speed * CFG.enemySpeedMultiplier * (CFG.enemyFlankSpeed * 0.875) : 0;
            this.facing = dx > 0 ? 1 : -1;
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
        const maxSimul = this.def.boss ? 4 : this.def.mini ? 2 : 1;
        const activeRushers = allEnemies.filter(e =>
            e !== this && !e.dead && e.engageDelay <= 0 &&
            Math.hypot(player.x - e.x, player.y - e.y) <= closeEnough + 90
        ).length;

        if (dist > closeEnough) {
            if (activeRushers < maxSimul) {
                if (Math.abs(dx) > 20) this.vx = this.facing * this.speed * CFG.enemySpeedMultiplier;
                else                   this.vx = 0;
                if (Math.abs(dy) > 12) this.vy = (dy > 0 ? 1 : -1) * this.speed * CFG.enemySpeedMultiplier * 0.5;
                else                   this.vy = 0;
                if (this.state !== 'walk' && this.state !== 'attack') this.setState('walk');
                if (this.state !== 'attack') this.moveXY(dt);
            } else {
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

            const feet_dy = (player.y + player.h) - (this.y + this.h);
            if (this.atkCD <= 0 && Math.abs(feet_dy) < 50) {
                this.setState('attack', CFG.enemyAttackDuration);
                this.atkCD = (this.def.boss ? 1.1 : this.def.mini ? 1.5 : CFG.enemyAtkCooldown) + Math.random();
                this.engageDelay = CFG.enemyReengageMin + Math.random() * CFG.enemyReengageRange;

                const snapX = this.x, snapY = this.y, snapFacing = this.facing;
                const snapFeetY = snapY + this.h;
                setTimeout(() => {
                    if (this.dead || player.invT > 0 || player.dead) return;
                    const pdx = Math.abs(player.x - snapX);
                    const pdy = Math.abs((player.y + player.h) - snapFeetY);
                    if (pdx < CFG.enemyAtkCheckDist && pdy < CFG.enemyAtkDepthTol)
                        player.takeDamage(Math.round(this.def.dmg * CFG.enemyDmgMultiplier), snapFacing);
                }, CFG.enemyAtkHitDelay);
            }
        }

        if (cam.x > 0) this.x = Math.max(cam.x - 250, this.x);
        this._separate(allEnemies);
    }

    // Resolve overlap with other enemies by nudging positions apart.
    _separate(allEnemies) {
        for (const other of allEnemies) {
            if (other === this || other.dead) continue;
            const cx = (this.x + this.w * 0.5) - (other.x + other.w * 0.5);
            const cy = (this.y + this.h * 0.5) - (other.y + other.h * 0.5);
            const minX = this.w * 0.5 + other.w * 0.5 + 4;
            const minY = this.h * 0.4 + other.h * 0.4;
            if (Math.abs(cx) < minX && Math.abs(cy) < minY) {
                const pushX = (minX - Math.abs(cx)) * Math.sign(cx || 1) * 0.5;
                const pushY = (minY - Math.abs(cy)) * Math.sign(cy || 1) * 0.5;
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
            this.setState('hurt', ENEMY_HURT_DURATION);
        }
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
                return _enemyPickFrame(charKey, 'attack', this.animT, {
                    duration: CFG.enemyAttackDuration,
                    holdTail: CFG.enemyAttackFrameHold,
                }) || idleImg;
            case 'hurt':
                return _enemyPickFrame(charKey, 'damage', this.animT, { duration: ENEMY_HURT_DURATION }) || idleImg;
            case 'knockedUp':
            case 'knockdown':
                return _enemyPickFrame(charKey, 'preDefeat', this.animT) ||
                    _enemyPickFrame(charKey, 'damage', this.animT, { duration: ENEMY_HURT_DURATION }) ||
                    idleImg;
            case 'getup':
                return _enemyPickFrame(charKey, 'preDefeat', this.animT) || idleImg;
            case 'dead':
                return _enemyPickFrame(charKey, 'defeat', this.deadT, { duration: CFG.defeatFadeDelay }) || idleImg;
            default:
                return idleImg;
        }
    }

    draw() {
        if (this.isDone) return;
        this.drawShadow();

        const img = this.getImg();
        if (!img || img.naturalWidth === 0) return;

        const flash = this.state === 'hurt' && Math.floor(this.animT * CFG.enemyHurtFlashFPS) % 2 === 0;
        const dw = img.naturalWidth  || this.w;
        const dh = img.naturalHeight || this.h;

        ctx.save();
        if (flash) ctx.globalAlpha = CFG.hitFlashAlpha;
        ctx.translate(this.screenX + this.w / 2, this.drawY + this.h);

        const useRotateDeath = !_enemyHasDirectFrames(this.def.img, 'defeat') && this.dead;

        if (this.dead) {
            const defRad = CFG.defeatRotation * Math.PI / 180;
            const defSc  = useRotateDeath ? 1 : _enemyDefeatScale(this.def.img, img);
            if (useRotateDeath) {
                ctx.rotate(-Math.PI / 2 + defRad);
                ctx.translate(CFG.defeatOffsetX + dh * 0.5, -CFG.defeatOffsetY + dw * 0.1);
            } else {
                ctx.rotate(defRad);
                ctx.translate(CFG.defeatOffsetX * this.facing, -CFG.defeatOffsetY);
            }
            ctx.scale(this.facing * CFG.defeatScaleX * defSc, CFG.defeatScaleY * defSc);
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

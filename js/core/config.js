// js/core/config.js — Game constants, tunable configuration, and character scale helpers

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
    playerAirControl:      0.75,   // air strafe speed multiplier (fraction of playerSpeed)
    // ── Animation speeds (frames per second) ────────────────────────────────
    playerWalkFPS:            5,
    playerIdleFPS:            2,
    playerInvFlashRate:      12,   // invincibility blink rate (flashes per second)
    enemyWalkFPS:             7,
    enemyIdleFPS:             1,   // enemy idle animation FPS (used when multi-frame idles exist)
    // ── Player hit detection ─────────────────────────────────────────────────
    collisionBodyOverlap:     6,
    collisionDepthTol:       28,
    // ── Character body blocking (player vs enemy) ───────────────────────────
    enemyBlockDepthExpand:    6,   // depth tolerance band for player↔enemy body collision
    // ── Object blocking (body collision stops movement) ──────────────────────
    objBlockDepthExpand:      8,   // expand feet-based blocking zone by this many px on each side
    // ── Object collision (player breaking crates) ────────────────────────────
    objCollisionRange:       72,
    objCollisionOverlap:     15,
    objCollisionDepthTol:    55,
    objBreakDropChance:    0.65,   // probability a smashed crate drops a health pickup
    // ── Pickup collection ────────────────────────────────────────────────────
    pickupRange:             55,
    pickupDepthTol:          60,
    // ── Controls (input feel) ────────────────────────────────────────────────
    // inputBufferTime = seconds an attack/jump press is remembered while the
    // player is busy or on cooldown, so rapid combo inputs are never dropped.
    inputBufferTime:       0.18,
    // ── Enemy AI ────────────────────────────────────────────────────────────
    enemyCloseEnough:        72,
    enemyAtkCheckDist:       95,
    enemyAtkDepthTol:        35,
    enemyAtkCooldown:       2.2,
    // ── Enemy static attack (attack from flank/wait position) ────────────────
    // A flanking enemy that has not committed to a rush still attacks when the
    // player walks within enemyStaticAtkRange px of it.
    enemyStaticAtkRange:     80,
    enemyStaticAtkCooldown: 1.6,
    // ── Enemy attack ────────────────────────────────────────────────────────
    enemyAtkHitDelay:       270,
    enemyKnockbackDist:      18,
    enemyLaunchKnockbackDist:70,
    // ── Hit response timings ─────────────────────────────────────────────────
    playerHurtInvTime:     0.55,
    playerKnockdownTime:    1.5,
    enemyKnockdownTime:     1.5,
    enemyGetupTime:        0.55,
    // ── Defeat sprite display ─────────────────────────────────────────────────
    defeatScaleX:           1.0,
    defeatScaleY:           1.0,
    defeatRotation:           0,
    defeatOffsetX:            0,
    defeatOffsetY:            0,
    defeatFadeDelay:        1.8,
    // ── Hit effects ───────────────────────────────────────────────────────────
    hitFlashAlpha:         0.45,
    // ── Combo ─────────────────────────────────────────────────────────────────
    comboTimeout:           2.5,
    // ── Stamina (run-kick) ────────────────────────────────────────────────────
    // staminaDuration   = seconds after a run-kick before the bar starts refilling
    // staminaRecharge   = seconds it takes to refill from empty to full
    // staminaLimitMode  = 0:none (unlimited)  1:per-level  2:per-game
    // staminaLimitCount = max number of recharges allowed when mode != 0
    staminaDuration:         1.0,
    staminaRecharge:         3.0,
    staminaLimitMode:          0,
    staminaLimitCount:         5,
    // ── Enemy global multipliers ─────────────────────────────────────────────
    enemyDmgMultiplier:      1.0,
    enemySpeedMultiplier:    1.0,
    enemyHealthMultiplier:   1.0,
    // ── Enemy engagement timing ──────────────────────────────────────────────
    enemyEngageDelayMin:     1.5,
    enemyEngageDelayMax:     2.0,
    enemyReengageMin:        1.3,
    enemyReengageRange:      1.4,
    enemyGetupReengageMin:   0.8,
    // ── Enemy AI movement ────────────────────────────────────────────────────
    enemyFlankRadius:       160,   // orbit radius when flanking player (px)
    enemyFlankSpeed:       0.32,   // fraction of enemy speed used during flanking
    enemySeparationSpeed:   150,   // max px/s an enemy is nudged apart from others
    // ── Enemy animation ──────────────────────────────────────────────────────
    enemyAttackDuration:      0.9,
    enemyAttackFrameHold:    0.50,
    enemyAttackFPS:            2,
    enemyHurtFlashFPS:        20,
    // ── Score ────────────────────────────────────────────────────────────────
    scoreMultiplier:         1.0,
    // ── Background ambience ──────────────────────────────────────────────────
    // Toggles the animated detail layer drawn over the static stage backgrounds
    // (neon flicker, water shimmer, warning lights, flames and embers).
    bgAmbience:            true,
    // ── Arena (debug) ────────────────────────────────────────────────────────
    groundMin:             390,
    groundMax:             510,
    fieldBorderPadding:      6,
    // ── Debug flags ─────────────────────────────────────────────────────────
    infiniteHealth:        false,
    infiniteEnemyHealth:   false,
    showHitboxes:           true,
};

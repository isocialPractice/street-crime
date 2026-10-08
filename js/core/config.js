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
    playerRunFPS:            12,   // run cycle speed (run0-7); faster than walk so the stride reads as a sprint
    playerIdleFPS:            2,
    playerTransitionTime:  0.35,   // seconds for the whole walk<>run transition (3 frames, ~0.117s each)
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
    // A crate absorbs objBreakHits blows before it gives way. The first blow
    // swaps it to the cracked sprite, the last one bursts it. 1 restores the
    // old one-shot behaviour.
    objBreakHits:             3,
    objHitShakeTime:       0.18,   // how long a surviving crate rocks after a blow
    objHitShakeDist:          4,   // peak sideways jolt of that rock, in px
    objBreakFxCount:         16,   // splinters thrown by the break effect
    objBreakFxTime:        0.65,   // seconds those splinters stay on screen
    // ── Pickup collection ────────────────────────────────────────────────────
    pickupRange:             55,
    pickupDepthTol:          60,
    // ── Controls (input feel) ────────────────────────────────────────────────
    // inputBufferTime = seconds an attack/jump press is remembered while the
    // player is busy or on cooldown, so rapid combo inputs are never dropped.
    inputBufferTime:       0.18,
    // ── Block ────────────────────────────────────────────────────────────────
    // Who can put a guard up. Held rather than tapped: the guard stays up for
    // as long as the key is down, and nothing can be thrown from behind it.
    blockForPlayer:        true,
    blockForEnemies:       true,
    // What a guarded blow still costs. With blockNoDamage on it costs nothing.
    // With it off, blockDamageTaken is how much of the blow still lands, on a
    // 1 to 10 scale against the attack's own damage: 10 is the whole hit, 1 is
    // a tenth of it. The toggle wins, so the scale only matters once it is off.
    blockNoDamage:         true,
    blockDamageTaken:         3,
    // Seconds the guard takes to come up, over which the block frames play once
    // before settling on the last of them.
    blockEnterTime:        0.14,
    // How long a guard shudders after turning a blow aside, and how fast it
    // alternates between the pose it settled on and the resist pose while it
    // does. With nothing coming in it simply holds.
    blockResistTime:       0.22,
    blockResistFPS:          14,
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
    playerHurtTime:        0.35,   // length of the damage reaction (Player_Damage_0-3)
    playerHurtInvTime:     0.55,
    playerKnockdownTime:    1.5,
    // Shape of a knockdown. The collapse frames play down over
    // playerCollapseTime, the flat pose is held, then the same frames run
    // backward over playerGetUpTime as the player pushes up. Both are scaled
    // down to fit when together they exceed playerKnockdownTime.
    playerCollapseTime:    0.40,
    playerGetUpTime:       0.45,
    // Defeat outro. The collapse plays over playerDefeatTime, the defeat pose
    // is held for playerDefeatHoldTime, and only then is the life spent and the
    // player respawned or the game ended.
    playerDefeatTime:      0.70,
    playerDefeatHoldTime:  1.20,
    enemyKnockdownTime:     1.5,
    enemyGetupTime:        0.55,
    // How long a multi-frame preDefeat collapse takes to play once an enemy is
    // on the ground. Past this the sequence holds its final downed pose for the
    // rest of the knockdown.
    enemyPreDefeatTime:    0.40,
    // Get-ups: a lethal blow only finishes an enemy once its getUps count runs
    // out. Each revive restores this fraction of max HP and stays down for
    // enemyGetUpDownTime, then the enemy taunts for enemyTauntTime if its
    // character maps a taunt animation.
    enemyGetUpHealthFactor: 1.0,
    enemyGetUpDownTime:    0.85,
    enemyTauntTime:        0.80,
    // Power attack reactions on the player. An enemy opts in through the
    // powerAttackEffect property in config/enemy-assets.json, and one that is
    // actually swinging a power attack gets playerFreeze without declaring
    // anything. A value beside powerAttackEffect named after a mode overrides
    // that mode's default here for the enemy that declares it.
    powerAttackFreezeTime:    1.0,   // input disabled and blinking (s)
    powerAttackKnockBackDist:  36,   // px the player is pushed back
    powerAttackDamageBonus:  0.25,   // extra damage as a fraction of the hit
    // ── Defeat sprite display ─────────────────────────────────────────────────
    defeatScaleX:           1.0,
    defeatScaleY:           1.0,
    defeatRotation:           0,
    defeatOffsetX:            0,
    defeatOffsetY:            0,
    // Defeat outro, in three phases. The defeat animation plays over
    // defeatFadeDelay; its final frame is then held on screen and blinked for
    // defeatBlinkTime; finally the body fades out over defeatFadeTime. The
    // three added together are how long a corpse lasts, which is also what a
    // wave waits on before it counts as cleared, so they are retuned together.
    defeatFadeDelay:        0.6,
    defeatBlinkTime:        1.0,
    defeatBlinkFPS:          12,
    defeatBlinkAlpha:      0.15,
    defeatFadeTime:        0.20,
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
    // Speed below which an enemy counts as standing rather than walking, so it
    // shows its idle pose instead of turning a walk cycle over a creep nobody
    // can see. _approach() ramps down as it closes on a target, so this is the
    // last couple of pixels of an approach. See Enemy._walkOrIdle.
    enemyWalkMinSpeed:       10,   // px/s
    // ── Enemy animation ──────────────────────────────────────────────────────
    enemyAttackDuration:     0.95,
    enemyAttackFrameHold:    0.50,
    enemyAttackFPS:            2,
    enemyHurtFlashFPS:        20,
    // How long the damage run plays for, and with it how long a blow staggers
    // an enemy. Blows landing inside the window extend it rather than restart
    // it, so a combo plays one reaction through instead of replaying its first
    // frame; see Enemy._beginHurt.
    enemyHurtTime:           0.55,
    // ── Score ────────────────────────────────────────────────────────────────
    scoreMultiplier:         1.0,
    // ── Background ambience ──────────────────────────────────────────────────
    // Toggles the animated detail layer drawn over the static stage backgrounds
    // (neon flicker, water shimmer, warning lights, flames and embers).
    bgAmbience:            true,
    // ── Local weather ────────────────────────────────────────────────────────
    // Render layer driven by the weather server directives. See
    // local-weather-style/STYLE.md for the directive to key mapping.
    // Current render: night / hot / stormy.
    weather:               true,
    weatherNight:          true,    // true: moon.svg  false: sun.svg + sky lift
    weatherTone:          'hot',    // 'hot' | 'medium' | 'cold'
    weatherPrecip:     'stormy',    // 'stormy' | 'cloudy' | 'sunny'
    weatherClouds:         true,
    weatherCloudCount:        7,    // clouds per drifting layer
    weatherRainCount:       170,    // simultaneous falling drops
    weatherRainSpeed:       780,    // fall speed (px/s)
    weatherWind:           0.42,    // horizontal drift as a fraction of fall speed
    weatherLightning:      true,
    weatherToneAlpha:      0.10,    // strength of the temperature colour grade
    weatherSkyLift:           0,    // daylight wash over the authored night sky
    // ── Arena (debug) ────────────────────────────────────────────────────────
    groundMin:             390,
    groundMax:             510,
    fieldBorderPadding:      6,
    // ── Debug flags ─────────────────────────────────────────────────────────
    infiniteHealth:        false,
    infiniteEnemyHealth:   false,
    showHitboxes:           true,
};

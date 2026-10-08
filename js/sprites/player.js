// js/sprites/player.js — Player sprite map
// PLAYER is a named sprite map; each key is a logical animation state.
// game entities read the matching key each frame and draw that image.

const PLAYER = {
    idle1:       loadSvgFile('assets/Player_Ideal_1.svg'),
    idle2:       loadSvgFile('assets/Player_Ideal_2.svg'),
    idle3:       loadSvgFile('assets/Player_Ideal_3.svg'),
    idle4:       loadSvgFile('assets/Player_Ideal_4.svg'),
    walk0:       loadSvgFile('assets/Player_Walk_0.svg'),
    walk1:       loadSvgFile('assets/Player_Walk_1.svg'),
    walk2:       loadSvgFile('assets/Player_Walk_2.svg'),
    walk3:       loadSvgFile('assets/Player_Walk_3.svg'),
    walk4:       loadSvgFile('assets/Player_Walk_4.svg'),
    walk5:       loadSvgFile('assets/Player_Walk_5.svg'),
    walk6:       loadSvgFile('assets/Player_Walk_6.svg'),
    walk7:       loadSvgFile('assets/Player_Walk_7.svg'),
    // transition0-2 bridge walk and run. Played forward (0>1>2) when the run
    // starts and backward (2>1>0) when it ends, over CFG.playerTransitionTime.
    transition0: loadSvgFile('assets/Player_Transition_0.svg'),
    transition1: loadSvgFile('assets/Player_Transition_1.svg'),
    transition2: loadSvgFile('assets/Player_Transition_2.svg'),
    // run0-7 is the looping run cycle, stepped at CFG.playerRunFPS.
    run0:        loadSvgFile('assets/Player_Run_0.svg'),
    run1:        loadSvgFile('assets/Player_Run_1.svg'),
    run2:        loadSvgFile('assets/Player_Run_2.svg'),
    run3:        loadSvgFile('assets/Player_Run_3.svg'),
    run4:        loadSvgFile('assets/Player_Run_4.svg'),
    run5:        loadSvgFile('assets/Player_Run_5.svg'),
    run6:        loadSvgFile('assets/Player_Run_6.svg'),
    run7:        loadSvgFile('assets/Player_Run_7.svg'),
    // Legacy single-frame run still, kept as the fallback when a run0-7 frame
    // is missing so the player never draws blank mid-stride.
    run:         loadSvgFile('assets/Player_Run.svg'),
    jump:        loadSvgFile('assets/Player_Jump.svg'),
    jumpKick:    loadSvgFile('assets/Player_JumpKick.svg'),
    kick1:       loadSvgFile('assets/Player_Kick_1.svg'),
    kick2:       loadSvgFile('assets/Player_Kick_2.svg'),
    punch1:      loadSvgFile('assets/Player_Punch_1.svg'),
    punch2:      loadSvgFile('assets/Player_Punch_2.svg'),
    // damage0-3 is the hit reaction, played once over CFG.playerHurtTime.
    damage0:     loadOptionalSvgFile('assets/Player_Damage_0.svg'),
    damage1:     loadOptionalSvgFile('assets/Player_Damage_1.svg'),
    damage2:     loadOptionalSvgFile('assets/Player_Damage_2.svg'),
    damage3:     loadOptionalSvgFile('assets/Player_Damage_3.svg'),
    // The original single damage pose, still the fallback for every sequence
    // below so the player is never blank whatever artwork is missing.
    knockDown:   loadSvgFile('assets/Player_Damage.svg'),
    // Optional dedicated knockdown art. A null here sends the renderer to the
    // collapse frames instead, and with those missing too it tips the damage
    // pose over procedurally.
    knockDownPose: loadOptionalSvgFile('assets/Player_KnockDown.svg'),
    // preDefeat0-7 is the collapse from standing to flat on the floor. It runs
    // forward as the player goes down and backward as they push up, so getting
    // up needs no artwork of its own. preDefeat is the older single pose, used
    // only when the numbered frames are absent.
    preDefeat:     loadOptionalSvgFile('assets/Player_PreDefeat.svg'),
    preDefeat0:    loadOptionalSvgFile('assets/Player_PreDefeat_0.svg'),
    preDefeat1:    loadOptionalSvgFile('assets/Player_PreDefeat_1.svg'),
    preDefeat2:    loadOptionalSvgFile('assets/Player_PreDefeat_2.svg'),
    preDefeat3:    loadOptionalSvgFile('assets/Player_PreDefeat_3.svg'),
    preDefeat4:    loadOptionalSvgFile('assets/Player_PreDefeat_4.svg'),
    preDefeat5:    loadOptionalSvgFile('assets/Player_PreDefeat_5.svg'),
    preDefeat6:    loadOptionalSvgFile('assets/Player_PreDefeat_6.svg'),
    preDefeat7:    loadOptionalSvgFile('assets/Player_PreDefeat_7.svg'),
    // The settled pose the body holds at the end of the defeat outro.
    defeat:        loadOptionalSvgFile('assets/Player_Defeat.svg'),
    // block0-1 is the guard coming up. blockHold is the pose it settles on and
    // holds for as long as the key is down; blockResist is what it alternates
    // with while a blow is being turned aside. All optional: with none of them
    // on disk the block state falls back to the idle pose.
    block0:        loadOptionalSvgFile('assets/Player_Block_0.svg'),
    block1:        loadOptionalSvgFile('assets/Player_Block_1.svg'),
    blockHold:     loadOptionalSvgFile('assets/Player_Block_hold.svg'),
    blockResist:   loadOptionalSvgFile('assets/Player_Block_resist.svg'),
    upperCut:    loadSvgFile('assets/Player_UpperCut.svg'),
    runningKick: loadSvgFile('assets/Player_RunningKick.svg'),
};

// Frame lists for the one-shot hit reactions. Filtering happens once, as the
// sprite files land, so a frame that is not on disk drops out of its sequence
// there instead of being tested every time the animation is drawn. Either list
// may legitimately come out empty; the player falls back to single-frame
// artwork when it does.
//
// Sprite files are fetched as one parallel batch rather than one blocking
// request per line above, so which of the optional frames actually exist is not
// known until that batch settles. Both lists are built there. They are empty
// until then, which is the same thing the renderer already falls back on, and
// the game does not start before ASSETS_READY waits the batch out.
let PLAYER_DAMAGE_FRAMES = [];
let PLAYER_COLLAPSE_FRAMES = [];

// The guard coming up, ending on the pose it settles on. PLAYER.blockResist is
// kept out: it is not part of the run, it is the frame the last one alternates
// with while a blow lands.
let PLAYER_BLOCK_FRAMES = [];

SVG_FILES_READY.then(() => {
    // An optional sprite with nothing behind it comes back flagged rather than
    // null, since the Image had to be handed out before the answer was known.
    dropMissingSvgFiles(PLAYER);

    PLAYER_DAMAGE_FRAMES = [
        PLAYER.damage0, PLAYER.damage1, PLAYER.damage2, PLAYER.damage3,
    ].filter(Boolean);

    PLAYER_COLLAPSE_FRAMES = [
        PLAYER.preDefeat0, PLAYER.preDefeat1, PLAYER.preDefeat2, PLAYER.preDefeat3,
        PLAYER.preDefeat4, PLAYER.preDefeat5, PLAYER.preDefeat6, PLAYER.preDefeat7,
    ].filter(Boolean);

    PLAYER_BLOCK_FRAMES = [
        PLAYER.block0, PLAYER.block1, PLAYER.blockHold,
    ].filter(Boolean);
});

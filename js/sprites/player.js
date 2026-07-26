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
    knockDown:   loadSvgFile('assets/Player_Damage.svg'),
    upperCut:    loadSvgFile('assets/Player_UpperCut.svg'),
    runningKick: loadSvgFile('assets/Player_RunningKick.svg'),
};

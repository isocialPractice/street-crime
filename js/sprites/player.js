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

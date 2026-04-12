// js/sprites/objects.js — Hit effects and interactable object sprites

// EFFECTS — three impact tiers used by HitFX.
// 'small' for punches, 'medium' for kicks/most attacks, 'hard' for uppercut/specials.
const EFFECTS = {
    small:   loadSvgFile('assets/Object_FadingImpact.svg'),
    medium:  loadSvgFile('assets/Object_FadingImpact_2.svg'),
    hard:    loadSvgFile('assets/Object_HardImpact.svg'),
    impact1: loadSvgFile('assets/Object_ImpactEffect.svg'),
    impact2: loadSvgFile('assets/Object_ImpactEffect_2.svg'),
};

// OBJECTS — sprites for breakable crates and health pickups.
// 'intact' and 'broken' are swapped by BreakableObj.draw() based on the 'broken' flag.
const OBJECTS = {
    intact:  loadSvgFile('assets/Object_Box.svg'),
    broken:  loadSvgFile('assets/Object_Box_Broken.svg'),
    health:  loadSvgFile('assets/Object_Health.svg'),
};

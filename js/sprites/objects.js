// js/sprites/objects.js — Hit effects and interactable object sprites

// EFFECTS — three impact tiers used by HitFX.
// 'small' for punches, 'medium' for kicks/most attacks, 'hard' for uppercut/specials.
const EFFECTS = {
    small:   loadSvgFile('assets/objects/Object_FadingImpact.svg'),
    medium:  loadSvgFile('assets/objects/Object_FadingImpact_2.svg'),
    hard:    loadSvgFile('assets/objects/Object_HardImpact.svg'),
    impact1: loadSvgFile('assets/objects/Object_ImpactEffect.svg'),
    impact2: loadSvgFile('assets/objects/Object_ImpactEffect_2.svg'),
};

// OBJECTS — sprites for breakable crates and health pickups.
// A crate runs through three states as it is beaten apart: 'intact' until the
// first blow lands, 'damaged' (cracked open, chunks knocked out of the rim)
// while it still has hits left in it, and 'broken' once it gives way.
// BreakableObj.draw() picks between them from the hit count.
const OBJECTS = {
    intact:  loadSvgFile('assets/objects/Object_Box.svg'),
    damaged: loadSvgFile('assets/objects/Object_Box_Damaged.svg'),
    broken:  loadSvgFile('assets/objects/Object_Box_Broken.svg'),
    health:  loadSvgFile('assets/objects/Object_Health.svg'),
};

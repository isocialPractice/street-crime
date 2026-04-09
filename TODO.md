# Street Crime — TODO

> Organized task list for the Street Crime beat-em-up project.
> Items are grouped by category. Check off tasks as they are completed.

---

## Current

- [ ] Core collision detection
- [ ] Key actions
- [ ] Add interactable background elements
- [ ] Add weapons
- [ ] Use side-scrolling image as level background art

## 1. Major

- [ ] Add a fourth stage with new environment theme and unique enemy wave compositions
- [ ] Implement a save/load system using localStorage for high scores and stage progress
- [ ] Add a character select screen allowing the player to choose from multiple playable fighters
- [ ] Implement a cooperative two-player mode (shared keyboard or gamepad support)
- [ ] Create a difficulty selection system (Easy / Normal / Hard) that scales enemy HP, damage, and spawn counts
- [ ] Build a proper title screen with animated background, menu navigation, and start prompt
- [ ] Add a cutscene or story dialog system between stages to give narrative context
- [ ] Implement a global leaderboard using a lightweight backend or GitHub Gist for score persistence
- [ ] Add gamepad support via the Gamepad API with configurable button mappings
- [ ] Refactor the single-file `game.js` into modular ES modules (input, physics, entities, AI, levels, HUD, renderer)

---

## 2. Minor

- [ ] Add a screen-shake intensity slider to debug mode
- [ ] Display a "NEW HIGH SCORE" notification when the player beats their previous best
- [ ] Add a brief invincibility flash effect when the player respawns after losing a life
- [ ] Implement a frame rate counter toggle in debug mode
- [ ] Add keyboard remapping support so players can customize controls
- [ ] Show a hit-damage number popup above enemies when they take damage
- [ ] Add a "FIGHT!" text splash at the start of each wave
- [ ] Smooth the camera lerp during free-scroll transitions between waves
- [ ] Add a visual countdown before each stage begins (3… 2… 1… FIGHT!)
- [ ] Display a brief tooltip for each attack type the first time the player uses it
- [ ] Add a subtle vignette overlay during boss encounters for dramatic effect
- [ ] Persist debug slider values to localStorage so they survive page reloads

---

## 3. Character Elements

> *Includes both player and enemy characters.*

- [ ] Add a grab/throw move for the player (grab enemy → toss into other enemies for area damage)
- [ ] Implement a player block/parry mechanic with a dedicated key and timed damage reduction
- [ ] Create a special meter that fills from combos and unleashes a screen-clearing super attack
- [ ] Add a dashing dodge-roll for the player with brief invincibility frames
- [ ] Give sub-bosses (Squirrly, GreenJetter, BadBlob) unique attack patterns beyond the standard rush-and-swing
- [ ] Add a second attack animation variant for enemies that currently only have one (`attack`)
- [ ] Implement enemy palette-swap variants that share sprites but have different stats (e.g., elite versions)
- [ ] Add ranged-attack enemy types (knife thrower, bottle tosser) with projectile physics
- [ ] Give KingBruteBreaker a multi-phase boss fight (new attacks trigger at 50% and 25% HP)
- [ ] Add idle taunt animations for enemies during their engage-delay flanking phase
- [ ] Implement a down-attack so the player can hit knocked-down enemies before they recover
- [ ] Create unique defeat animations per character type instead of the shared scale-down fade
- [ ] Add a stagger mechanic — consecutive hits without pause briefly stun the enemy
- [ ] Give the player a health regeneration tick when standing idle for 5+ seconds out of combat
- [ ] Add crowd-cheer voice lines or grunt sound effects triggered by high combo counts

---

## 4. Object Elements

- [ ] Add new breakable object types: trash cans, fire hydrants, newspaper stands, wooden barrels
- [ ] Implement weapon pickups dropped from objects (pipe, bat, chain) with unique attack sprites and bonus damage
- [ ] Add throwable objects the player can pick up and hurl at enemies (bottles, bricks)
- [ ] Create hazard objects that damage both player and enemies on contact (flaming barrel, electrified fence)
- [ ] Add a crate drop animation with bounce and dust particles when objects are destroyed
- [ ] Implement score pickups (coins, wallets) dropped from breakable objects alongside health
- [ ] Add a temporary speed-boost pickup (sneaker icon) that increases player speed for 10 seconds
- [ ] Create a temporary invincibility pickup (star or shield icon) with a flashing player sprite
- [ ] Add stage-specific destructible scenery — dumpsters on Stage 1, shipping crates on Stage 2, chemical drums on Stage 3
- [ ] Vary the number and placement of breakable objects per wave, not just per stage
- [ ] Add a visual indicator (glow or subtle bounce) on breakable objects so players know they are interactive
- [ ] Implement a combo-multiplier pickup that temporarily doubles the combo score

---

## 5. Background Elements

- [ ] Add animated background details — flickering neon signs (Stage 1), moving crane (Stage 2), burning flames (Stage 3)
- [ ] Implement multi-layer parallax (far buildings, mid structures, near street objects) for richer depth
- [ ] Add weather effects: rain and puddle reflections on Stage 1, fog on Stage 2, smoke/embers on Stage 3
- [ ] Create foreground overlay elements (lamp posts, fences) that render in front of characters for depth
- [ ] Add ambient NPCs in the background (bystanders ducking, cars driving past, rats scurrying)
- [ ] Implement dynamic lighting shifts — street lights flicker, headlights sweep, boss arena darkens on encounter
- [ ] Add a skyline gradient that subtly shifts color as the player progresses through each stage
- [ ] Create transition animations between stages (camera pan, fade-to-black, doors opening)
- [ ] Add environmental storytelling props in backgrounds — graffiti, wanted posters, broken windows that worsen per stage
- [ ] Implement a ground surface variation — puddles, cracks, manhole covers — with subtle sprite overlays on the walkable zone

---

## 6. Audio & Sound Effects

- [ ] Add punch, kick, and uppercut impact sound effects with slight random pitch variation
- [ ] Implement looping background music tracks per stage using the Web Audio API
- [ ] Add enemy hurt grunts and defeat cry sound effects per character archetype
- [ ] Create a boss encounter music change — darker, faster tempo when the boss health bar appears
- [ ] Add ambient background audio: city noise (Stage 1), water/industrial hum (Stage 2), fire crackle (Stage 3)
- [ ] Implement a combo hit-streak escalating sound (pitch rises with each additional hit)
- [ ] Add UI interaction sounds — menu select, pause, stage clear fanfare, game over jingle
- [ ] Add a crate-smash sound effect and a health-pickup chime
- [ ] Implement a master volume slider and mute toggle in the pause menu
- [ ] Add footstep sounds that vary by surface (concrete, metal grate, wood)

---

## 7. UI & HUD Enhancements

- [ ] Add an animated health bar that smoothly drains instead of jumping to the new value
- [ ] Implement a mini-map or enemy radar showing remaining enemies and their positions
- [ ] Add a move-list overlay accessible via a help key showing all attack inputs
- [ ] Display the current wave number within a stage (e.g., "Wave 2 / 4")
- [ ] Create a post-stage stats screen: enemies defeated, damage taken, max combo, time elapsed
- [ ] Add a lives indicator using character head icons instead of plain text
- [ ] Implement floating score popups at the point of each hit (+100, +200, etc.)
- [ ] Add a boss health bar that reveals incrementally as a dramatic intro effect
- [ ] Create a mobile-friendly virtual D-pad and attack button overlay for touch devices
- [ ] Show a brief freeze-frame and zoom on the killing blow of each boss
- [ ] Add an end-of-game credits scroll listing all enemy character names and their sprites
- [ ] Implement a settings menu for toggling hitbox display, screen shake, and damage numbers

---

## 8. Performance & Code Quality

- [ ] Profile the render loop and reduce unnecessary `drawImage` calls for off-screen entities
- [ ] Implement an object pool for hit-effect sprites to avoid repeated allocation and GC pressure
- [ ] Cache scaled/flipped sprite canvases instead of recalculating transforms every frame
- [ ] Add automated integration tests that simulate a full stage playthrough and verify score and state
- [ ] Lazy-load stage background SVGs so only the current stage's assets are in memory
- [ ] Implement a build script that minifies `game.js`, `assets.js`, and `style.css` for production
- [ ] Add JSDoc type annotations to the major classes (Player, Enemy, LevelManager, HUD) for IDE support
- [ ] Set up a GitHub Actions CI workflow that runs linting and tests on each push
- [ ] Reduce SVG parse time by converting frequently used sprites to pre-rendered PNG sprite sheets at build time

---

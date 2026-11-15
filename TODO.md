# Street Crime — TODO

> Organized task list for the Street Crime beat-em-up project.
> Items are grouped by category. Check off tasks as they are completed.
> The order the work goes in, and why, is in [ROADMAP.md](ROADMAP.md).

---

## Current

### User Only - Update Assets

#### Create

- [x] Player block sprites
- [ ] Add interactable background elements
  - Create graphics
  - Config system to map interactable background elements i.e.
    - [x] Open door: `ENTERABLE-<name>` / `ENTER-building` in the level SVG (see [Level Map](#level-map))
    - [ ] Climb something
    - [ ] Talk to friendly character
- [ ] Add weapons
  - Create graphics

#### Organize

- [ ] Rename player and enemy asset layer names, allowing for sprite customization
  - Fill in `scripts/data/layerMap.json` and run `scripts/mapLayers.jsx` (see [scripts/README.md](scripts/README.md) and [Asset Scripts](#asset-scripts))
  - Re-export the renamed artboards to `assets/`

#### Effects

- [ ] Effects for graphics:
  - Attack collision
  - Character movements
  - Stage background elements
- [ ] Sound effects

### Documentation

> In [docs/](docs/README.md), published with the demo on GitHub Pages once
> [Documentation Site](#documentation-site) is done.

- [x] Documents for creating character assets
  - Layer naming for correct game mapping
  - [docs/character-assets.md](docs/character-assets.md)
- [x] Documents for creating object assets
  - Layer naming for correct game effects
  - [docs/object-assets.md](docs/object-assets.md)
- [x] Documents for creating levels
  - Layer naming for correct game interactions: [docs/level-naming.md](docs/level-naming.md)
  - Correct asset naming for level animations: [docs/level-naming.md](docs/level-naming.md#animate-frame-animation), [docs/object-assets.md](docs/object-assets.md#animation-frames)
  - When things happen: [docs/level-design.md](docs/level-design.md)
- [x] Each type of documentation have corresponding:
  - Verbose: Full documentation for feature
  - Quickstart: A `tldr` version of documentation for someone unfamiliar (`docs/<topic>_quickstart.md`, and the root [QUICKSTART.md](QUICKSTART.md))
  - Cheatsheet: A `tldr` for someone needing quick reminder, and someone unfamiliar (`docs/<topic>_cheatsheet.md`, and the root [CHEATSHEET.md](CHEATSHEET.md))

### Documentation Site

> The docs and the playable demo on GitHub Pages, built by
> `.github/workflows/pages.yml` (see [ROADMAP.md](ROADMAP.md)). The workflow
> builds and checks the site on every push to `main`, and deploys only once the
> Pages source is GitHub Actions.

- [ ] Switch the GitHub Pages source from the `main` branch to GitHub Actions
  - **Issue**: Pages publishes in legacy mode, straight from `main` at `/`. That
    is what serves the demo today, so it was not switched without asking. Until
    it is, the new workflow builds the site and skips its deploy job, and
    `/street-crime/docs/` shows the docs unstyled, rendered by the legacy build.
  - **Goal**: Settings > Pages > Build and deployment > Source set to **GitHub
    Actions**, then the workflow run again (Actions > Pages > Run workflow, or the
    next push). The game stays at `/street-crime/`; the styled docs appear at
    `/street-crime/docs/`. If the run fails, setting the source back to the `main`
    branch restores the old site.
  - From: Documentation Site
- [ ] Verify the GitHub Pages deploy of the docs and the demo
  - **Issue**: The workflow was written and checked locally, but Jekyll was never
    run on this machine (no Ruby), so the first real build happens on GitHub.
  - **Goal**: The Pages workflow run for the commit that carries the site ends in
    `success`, checked with
    `gh run list --repo isocialPractice/street-crime --branch main --json name,conclusion,status,headSha`
    for that commit, not with `pages/builds/latest` (which a site deployed from
    Actions never produces). Then a look at the live pages: the menu on a phone,
    both themes, a link into a heading, and the demo still playing.
    A `200` from `curl` alone does not count: a failed deploy leaves the old site
    answering `200`.
    - Workflow: `.github/workflows/pages.yml`
    - Site commit: `e2ba1c0` added the site; the run to check is the one for
      whatever `main` points at when it is first pushed with that commit in it
    - URLs: <https://isocialpractice.github.io/street-crime/> and <https://isocialpractice.github.io/street-crime/docs/>
  - From: Documentation Site

### Game

- [ ] **Pause**: Auto map assets
  - Create plan to map and apply new actions using JSON configuration
- [ ] Core collision detection
- [ ] Key actions
- [ ] Add object sprites with different states relative:
  - Attack impacts
  - Stage progression
  - Config system to map weapon use
- [ ] Use side-scrolling image as level background art
- [x] Add configuration system to map where enemies spawn for each level
  - Spawn groups in `config/levels/<level>/level-design.json`, coming out of a
    layer named by path ([docs/level-design.md](docs/level-design.md#spawn-groups))
- [x] Add interactable object elements
  - [x] Breakable scenery cut from the level SVG (`BREAKABLE-<name>`)
  - [x] Animated scenery from frame files (`ANIMATE-<asset-name>`)
  - [x] Interact areas that report `interact:<name>` on E (`OBJECT-<name>`)
  - [x] Something that listens to `interact:` and does more than report it:
    the level design director, whose `next` triggers wait on `interact:` and every
    other level event

### Level Map

> Doors, locks, breakable and animated scenery, trigger areas and no-go areas set
> up by layer name in a level SVG (`js/level/level-map.js`,
> [docs/level-naming.md](docs/level-naming.md)), and what happens when, in
> `config/levels/<level>/level-design.json` (`js/level/level-design.js`,
> [docs/level-design.md](docs/level-design.md)). Tried out in SANDBOX TEST, from
> `config/debug/sandbox.json`, one step at a time.

- [x] Read map ids from a level SVG, with a debug overlay and typo warnings
- [x] `negative-space` holes in the field; rushing enemies walk around them
- [x] `ANIMATE-` frames, `loop` / `yoyo`
- [x] `BREAKABLE-` pieces that break like crates, with optional `_damaged` / `_broken` art
- [x] `ENTER-building` doors with a fade, an interior, and the way back out
- [x] SANDBOX TEST menu entry and `config/debug/sandbox.json`
- [x] `RESTRICTED-` locked enterables, unlocked by `REQUIRE-case-` / `REQUIRE-state-` layers or the level design
- [x] `EVENT-` trigger areas; `INVENTORY-`, `MISSING-`, `SWITCH-`, `USABLE-` recognised as planned
- [x] Layer paths (`RESTRICTED-import-export-warehouse/ENTER-building`) so a design names places, not coordinates
- [x] Doors drawn above the field reach down to the ground below them (the warehouse door, past the parked car)
- [x] Level design files: states, cases, triggers, spawn groups from a layer, player entrances, `fade-out`, drafts converted with notes, "did you mean" warnings
- [x] Sandbox steps 1 to 6 for the level design, ending on `config/levels/theStreets/level-design.json`
- [x] Crews written once under `groups`, with `order`, a count from the pool, and part of a crew recolored (`count`, `re-render`, `name`)
- [x] Condition cases (`alive`, `fled`, `inventory`, `case`, `state`), a state's own `cases`, locks that follow a condition (`"type": "condition"`), steps that branch with `when`, and `reset`
- [x] Spawns from the view's `edges`, crews that come back with their health (`inherit`) or run off (`"then": "flee"`)
- [x] `INVENTORY-` items to take and `REQUIRE-item-` locks, with the inventory, the item screen and the Ctrl+I command line ([docs/inventory.md](docs/inventory.md))
- [x] Sandbox steps 8 to 10, and the real `theStreets` design rewritten from its shorthand: the key in the warehouse decides whether the response crew fights or runs
- [ ] `ENTER-vehicle` handler: a different movement mode while driving (recognised and stubbed today)
- [ ] Load a level from its folder through `config/levels.json` (still reports "not built yet"), using the level map and its `level-design.json` through `LevelDirector`, the way the sandbox's `level-design` test does; hand `store`d health on to the next level
- [ ] Draw tall breakables in correct depth order (the gate arm sorts by its bottom edge)
- [ ] Flanking and holding enemies steer around holes too (only rushing ones do)
- [ ] Art: trim `#field` in `level-theStreets.svg` to the 2915-unit viewBox (it runs to x 13113)
- [ ] Art: outline the BAD BAR sign text and its three frames (Myriad Pro is not available to browsers)
- [ ] Art: replace the placeholder `enterables/badBar.svg` with the bar's interior, with an `ENTER-exit` at its door
- [ ] Art: if the gate should seal the lot until it breaks, extend the arm or add `negative-space` (there is room past it above and below)
- [ ] Art (optional): `parking-gate-arm_damaged.svg` and `parking-gate-arm_broken.svg` in `theStreets/objects/`
- [ ] Art: replace the placeholder `enterables/import-export-warehouse.svg` (a copy of the bar's placeholder) with the warehouse interior, with an `ENTER-exit` at its door
  - It now holds `OBJECT-key-crate` with an empty `INVENTORY-key` rect on its second screen, where the key lies; keep a layer by that name where the key should be
- [ ] Enemies coming in from the view's edges walk straight through `negative-space` (the parked car) on the way; only where they stop is kept off holes
  - Route the walk in around holes, as rushing enemies already do
- [ ] Art: the parked red car's `negative-space` (world x 690 to 967) sits in front of the warehouse door (x 633 to 805)
  - The player can only use the door from the street below the car, and enemies coming out in the middle and right lanes cross the car's back end
  - Move the car right of x 805, or give `#field` a notch up to the warehouse door the way the bar has one

### Asset Scripts

> Goal: every part of every sprite has a name in its source `.ai`, so each
> exported SVG part has an id the game can recolor or swap. Covers the player,
> enemies, objects and the environment art still to come. Tooling lives in
> `scripts/`, with usage in [scripts/README.md](scripts/README.md).

- [x] `scripts/mapLayers.jsx`: rename layers from a JSON map (`scripts/data/layerMap.json`)
- [x] `scripts/runAdobeScript.pl`: run Illustrator scripts from the command line (port of `runAdobeScript.bat`)
- [x] `scripts/mapSelectLayers.jsx`: select what a layer map points at in an open document, to check a map before running it
- [ ] `scripts/mapSelectLayers.jsx`: exit with status 1 on errors (no document open, `doc=` not open, bad map or option)
  - Errors already print as one line on stdout, but the exit status stays 0, so a batch file cannot tell a failure from a success
  - Keep the one-line stdout message. The runner needs a way to recognise a failure result, since a thrown error is what turns into status 1 today and it prints as Illustrator's longer `Error 54: Uncaught JavaScript exception: ...` text
- [x] `support/` for source `.ai` files: git-ignored, with `source-player.ai` and `source-enemies.ai` force-added as examples

#### Port from `userScripts/`

`userScripts/` is local and git-ignored. Whether each script should get a copy
in `scripts/`:

- [ ] **`extractLayerNameList.jsx`: port first**, as `scripts/exportLayerMap.jsx`
  - It writes the selected group's hierarchy to `layerNames.txt`. That
    hierarchy is the `current` tree of a layer map, which is typed by hand
    for now
  - Emit JSON instead: `current` filled from the document, `change` as an
    identical copy to edit, unnamed items as `<Path>`, `<Group>`, ...
  - Take `doc=`, `layer=` (or the selection when run from the menu) and
    `out=` arguments, so it runs through `runAdobeScript.pl`
  - ExtendScript has no `JSON.stringify`, so it needs a small writer
- [ ] **`groups.jsx`: port**
  - It names each frame group after its artboard (`walk_0`, ...), and that
    name becomes the `<g id>` the frame's parts sit under
  - Replace the `prompt` with a `layer=` argument, and add `all=1` for every layer
- [ ] **`artboards.jsx`: port**
  - Artboard names become exported file names (`Player_Walk_0.svg`), so this
    is where the `<name>_<action>_<n>` naming gets enforced (see
    [Template Repo](#9-template-repo-draft-plan))
  - Replace the `prompt` with a `suffix=` argument
- [x] **`renameSelectedLayers.jsx`: moved to `scripts/` unchanged**
  - It works on the live selection and prompts for a pattern, so it runs from
    File > Scripts, not the command line. `mapLayers.jsx` covers the batch case

#### Layer naming for customization

- [ ] Agree on a naming scheme and document it in `scripts/README.md`
  - Parts: the names already in use (`front-glove`, `back-shoe`, `Head`, `hair`, ...)
  - Tones inside a part: `<part>-light`, `<part>-mid`, `<part>-dark`,
    `outline`, which `Player_Block_0.svg` already does with `arm-light`,
    `arm-mid` and `arm-dark`
  - Outfit pieces: one group per swappable piece (`jacket-a`, `jacket-b`, `hat`)
- [ ] One map per character in `scripts/data/maps/<Name>.json`, with `map=` accepting a folder
  - [ ] Player (`support/source-player.ai`)
  - [ ] Enemies (`support/source-enemies.ai`)
  - [ ] Objects (`support/source-objects.ai`)
  - [ ] Environment (`support/source-environment.ai`, once that art exists)
- [ ] Re-export the renamed artboards and confirm the new ids reach `assets/*.svg`

#### Game side

- [x] Variant loader: transform the SVG text before it becomes an image
  - Built as `js/sprites/variants.js`, applied per frame through
    `_loadEnemyFrame`'s transform rather than in `_applySvgText`, and cached by
    file plus render
  - Exported fills come from `.cls-N` classes in `<style>`, so a recolor sets
    an inline `fill`, which wins over the class, instead of editing the class
  - Parts by base name with the export's `-N` suffix stripped, falling back from
    `left-vest` to `vest`; tones from the nearest `-<tone>` layer name
- [x] Palettes: `config/palettes.json` (tones, lightest first, and a color per
  tone), used by a level design's pool entry `{ "enemy", "render": { "<part>": "<palette>" } }`
- [ ] Named variants, such as `config/variants.json`
  - **Issue**: A render is written inline in each design's pool, and has its
    base enemy's stats; outfit pieces cannot be shown or hidden.
  - **Goal**: A named variant (`"jumpingjunkie-gray"`) with a render, its own
    stats (`hp`, `spd`, `dmg`, `pts`) and outfit pieces to show or hide (the
    planned `{ "hide": true }` render value), usable from any design's pool.
  - From: Asset Scripts
- [ ] Use it for the enemy palette-swap elites listed under [Character Elements](#3-character-elements)
- [ ] Art: check the `vest-dark` group in `JumpingJunkie_defeat.svg`
  - **Issue**: It holds brown shapes beside the head as well as the vest, so the
    gray render turns them gray too.
  - **Goal**: If they are hair or collar, move them out of `vest` (a layer map
    in `scripts/data/`); if they are vest, nothing to do.
  - From: Asset Scripts
- [ ] Art: name CrimeGuy's vest and leg layers in every frame
  - **Issue**: `theStreets`' gray CrimeGuy keeps his gold vest in `_attack`,
    `_punch`, `_preDefeat` and `_defeat`, which name no `left-vest` or
    `right-vest` layer (nor a bare `vest`), and `_walk_1` has two `back-leg`
    layers and no `front-leg`. The game says so once per file in the console.
  - **Goal**: The layers named in a layer map in `scripts/data/` and applied in
    Illustrator, so every frame turns gray; or the crew uses the gray
    JumpingJunkie, whose every frame is named.
  - From: Level Design Config
- [ ] Player outfit and color select, tied to the character select screen under [Major](#1-major)

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

- [x] Add animated background details — flickering neon signs (Stage 1), blinking warning lights and water shimmer (Stage 2), burning flames and embers (Stage 3)
- [ ] Animate the Stage 2 crane (swinging hook, moving trolley)
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

## 9. Template Repo (Draft Plan)

> For later, once the asset pipeline is good enough: reverse engineer this repo
> into a template repo where adding a character only takes art named
> `<name>_<action>.svg` or `<name>_<action>_<n>.svg`. The `<action>` ending,
> with or without a frame number, is what makes an asset plug and play.

- [ ] **Naming contract**: `<name>_<action>.svg` is a single pose,
  `<name>_<action>_<n>.svg` is frame `n` of a sequence, sorted by number so
  `_10` comes after `_9`, and a bare `<name>.svg` is the default pose
- [ ] **Action vocabulary**: a fixed list of actions the engine understands
  (`idle`, `walk`, `run`, `attack`, `kick`, `punch`, `jump`, `damage`,
  `preDefeat`, `defeat`, `block`, `block_hold`, `block_resist`, ...), each with
  a default mode (`loop`, `sequence`, `hold`) and fallback state, as
  `config/enemy-assets.json` already sets under `defaults`. Unknown actions
  warn and are ignored
- [ ] **Manifest generator**: a static site cannot list a folder, so a script
  in `scripts/` scans `assets/`, groups files by name and action, and writes
  `config/asset-manifest.json`. The loader reads that in place of
  hand-written `suffixes` lists, which stay as overrides
- [ ] **Entity type**: choose between folders (`assets/player/`,
  `assets/enemies/`, `assets/objects/`, `assets/environment/`) and a name
  prefix rule
- [ ] **Normalize this repo's names first**, or have the manifest tolerate them:
  - `ideal` stands in for `idle` (`Player_Ideal_*`, `BadGirl_ideal_*`)
  - Action case varies: `Player_Walk` and `Player_PreDefeat` against
    `BadOne_walk` and `BadGirl_preDefeat`
  - Frames start at `_0` in some sets (`BadOne_walk_0`, `BadGirl_ideal_0`) and
    at `_1` in others (`BadGirl_walk_1`, `Player_Ideal_1`)
- [ ] **Illustrator side**: ship `scripts/` (the ported `artboards.jsx`
  enforcing the naming contract, `mapLayers.jsx`, the layer map export) and
  the `support/` convention, and document the SVG export settings
- [ ] **Strip game content**: cut levels, roster and stages down to one sample
  character, one enemy and one stage
- [ ] **Publish**: mark the repo as a GitHub template, with a first-run script
  that renames the game and clears the sample art
- [ ] Fold in the paused **Auto map assets** item under [Game](#game), which
  this plan would replace
- [ ] The template ships one sample level that shows the whole level format
  - **Issue**: A template user learns the format fastest from a level that
    already works, and the stripped-down template would otherwise keep none.
  - **Goal**: One small level with named layers (field, an enterable, a locked
    door, a breakable, an animated sign, a trigger area), its `level-design.json`,
    and the sandbox step tests that prove each part, the way `theStreets` and
    `design-1` to `level-design` do here.
  - From: Template Repo
- [ ] The template ships the docs site, ready to publish
  - **Issue**: `docs/`, `.github/workflows/pages.yml`, `DESIGN_LANGUAGE.md`,
    `scripts/stageDocs.js` and `scripts/checkAssetCase.js` all name this
    repository (`isocialpractice.github.io/street-crime`, the GitHub URL in
    `docs/_config.yml` and `stageDocs.js`).
  - **Goal**: The first-run script rewrites the repository name, owner and URLs
    in those files, so a new game's docs and demo publish from the first push
    once its Pages source is GitHub Actions.
  - From: Template Repo
- [ ] The first-run script clears the sample level but keeps the formats
  - **Issue**: Clearing sample art must not take the level design schema, the
    sandbox test format or the docs with it.
  - **Goal**: After the script runs, `config/schema/level-design.schema.json`,
    an empty `config/debug/sandbox.json` with one commented example, and the docs
    remain; the sample level, its design and its art are gone.
  - From: Template Repo
- [ ] The template ships the `level-design` agent skill
  - **Issue**: `skills/level-design/` points at this repository's paths and at
    `theStreets` as its worked example (`config/levels/theStreets/level-brief.md`),
    and a template user would want it from the first day.
  - **Goal**: The template keeps `skills/`, `package.json`, `scripts/installSkills.js`
    and the check scripts; the skill's worked example becomes the sample level; the
    first-run script runs `npm run skills` for the agents the new repository uses.
  - From: Template Repo

---

## 10. Level Design Config

> Make `config/levels/<level>/level-design.json` the level format the template
> ships: everything a level does, written as data, with the engine knowing no
> level by name. Builds on the director in `js/level/level-design.js` and the
> format in [docs/level-design.md](docs/level-design.md).

Intent: a level is art plus one design file, with no code.

- [ ] Rosters: pick enemies by tier, not only by id
  - **Issue**: A spawn group's default pool is worked out from `ENEMY_DEFS`
    flags and `STAGES` leaders, and `pool` takes ids only, so a design cannot say
    "three grunts" without naming them, and a template user cannot add a tier.
  - **Goal**: Tiers such as `grunt`, `elite`, `subboss` and `boss` in config
    (`config/rosters.json`, or per level), and `pool` accepting a tier name. The
    schema, vocabulary table and validator learn the new value together.
  - From: Level Design Config
- [ ] Stage waves as design states
  - **Issue**: The three stages' waves, sub-bosses and bosses are hard-coded in
    `STAGES` (`js/level/data.js`) and run by `LevelMgr`, beside the director
    rather than through it.
  - **Goal**: A stage's waves written as states with spawn groups and
    `defeated:` steps, so one engine runs both, and `LevelMgr` can retire once the
    stages load from `config/levels.json`.
  - From: Level Design Config
- [ ] Share states between levels with `extends`
  - **Issue**: Every level would repeat its intro, its clear and its boss
    states, word for word.
  - **Goal**: A design names another file under `extends` and overrides only the
    states and cases it changes; the validator reads the merged result and says
    which file each warning came from.
  - From: Level Design Config
- [ ] Handlers for the remaining planned layer names
  - **Issue**: `MISSING-`, `SWITCH-` and `USABLE-` are recognised and warned
    about, but do nothing, and `use <item> on <thing>` on the command line reads
    the thing and does nothing with it. (`INVENTORY-` and `REQUIRE-item-` are
    built, see [docs/inventory.md](docs/inventory.md); `ENTER-vehicle` is tracked
    under [Level Map](#level-map).)
  - **Goal**: `MISSING-` objects that an item is used on, from the item screen or
    `use <item> on <thing>`; `SWITCH-` objects that set cases; `USABLE-` objects
    carried in the hands but not stored; each reporting an event a design can wait
    on, as the draft in `.support/DRAFT_docs-level-naming.md` describes.
  - From: Level Design Config
- [ ] Item storage
  - **Issue**: There is no drop or discard on the item screen, as in the genre's
    originals, so with every slot full an item has to stay where it lies.
  - **Goal**: A place to store items and take them back later (an item box, an
    `OBJECT-` layer with a marker inside it), shared by every box in the level, as
    the genre does it.
  - From: Level Design Config
- [ ] Weapons, held and equipped
  - **Issue**: The item screen's HOLDING always says FISTS; weapons have no art
    yet (User Only, Add weapons).
  - **Goal**: Weapons as catalog items, an EQUIP command beside USE, CHECK and
    COMBINE, and HOLDING showing the one in hand; the attack using it.
  - From: Level Design Config
- [ ] Each level's own item catalog
  - **Issue**: Only a sandbox test names a catalog (its `"items"`); a level loaded
    for real has none, so its `INVENTORY-` layers would name nothing.
  - **Goal**: A level's catalog in its folder (`assets/levels/<level>/objects/`,
    as the draft says), loaded with the level from `config/levels.json`.
  - From: Level Design Config
- [ ] FILE and MAP pages on the item screen
  - **Issue**: The item screen shows the player and the slots only.
  - **Goal**: Pages for notes found in a level (files, as items that are read
    rather than used) and a map of the level's screens and doors, reached from the
    item screen.
  - From: Level Design Config
- [ ] Leave a spent key behind
  - **Issue**: A key keeps its slot after the last lock it opens is open.
  - **Goal**: Once nothing in the level needs it any more, ask whether to leave
    it behind, and free the slot on YES.
  - From: Level Design Config
- [ ] Check Ctrl+I in Firefox
  - **Issue**: The command line's Ctrl+I is `preventDefault`ed and works in
    Chrome. Firefox opens Page Info on Ctrl+I; whether a page can stop that was
    not tried (no Firefox where it was built).
  - **Goal**: Try it in Firefox. If Page Info opens, give the command line a
    second key as well.
  - From: Level Design Config
- [ ] theStreets: the two bar outcomes with the warehouse crew still standing
  - **Issue**: The warehouse is locked until its crew is beaten, so the response
    crew never meets a standing warehouse crew: leaving the bar never reaches
    `crew-returns`, and the "fought and beaten, warehouse crew standing" outcome
    cannot happen.
  - **Goal**: Decide whether to keep them as written, or also bring the warehouse
    crew back in from the edges when the player leaves the bar mid-fight in
    `gate-breaks`, which can happen in play. (The action matrix reports
    `crew-returns` as never entered; `config/levels/theStreets/level-brief.md`
    lists it as meant for now.)
  - From: Level Design Config
- [ ] theStreets: the warehouse door stays open after the gate is mended
  - **Issue**: `gate-reset` locks the warehouse again, but the door's glass and
    handles, slid apart when the gate broke, stay apart; breaking the gate again
    does not slide them, since a layer sent where it already is stays put.
  - **Goal**: Decide whether `gate-reset` also puts them back, with `reset`
    `animate:door-glass-left` and the other three door layers.
  - From: Level Design Config
- [ ] theStreets: leaving the bar mends the gate before the response crew has gone
  - **Issue**: In `response-flees`, the step on `exit:bad-bar` to `gate-reset`
    does not wait for the response crew to finish running off: ducking into the bar
    while they look, then walking out, mends the gate at once.
  - **Goal**: Decide whether that step also needs `"response-crew-down": true` in
    its `when` (`alive` does not count enemies that ran off, so the case turns true
    once they are gone).
  - From: Level Design Config
- [ ] Keep a building's enemies when the player walks out
  - **Issue**: The level runtime keeps only the street's enemies while the player
    is elsewhere: `_exitScene` in `js/level/level-runtime.js` takes the street's
    list back, and every interior starts empty. A crew fighting inside a building is
    dropped when the player walks out, but its group still counts it, so
    `defeated:<group>` never comes, while plain `alive` drops to 0 at once.
  - **Goal**: Each scene keeps its own enemies, held still while the player is in
    another, as the street's are. Then the `level-design` skill's "Ambush when you
    take it" pattern needs no waiting states, and the action matrix
    (`scripts/lib/levelMatrix.js`) stops modelling lost crews.
  - From: Level Design Config
- [ ] `design-9-conditions` can get stuck in `gate-watch`
  - **Issue**: The gate can be broken before the runners have fled, since no state
    before `gate-watch` has a step for it; `gate-watch`'s only step then waits on a
    `break:parking-gate-arm` that cannot happen again. Found by
    `node scripts/checkLevelDesign.js design-9-conditions --matrix`.
  - **Goal**: `gate-watch` also moves on when the gate is already broken (a step
    with `when` on a case set by the break, or a `reset` of the gate on entering
    it), or its brief says the dead end is meant.
  - From: Level Design Config
- [ ] Briefs for the sandbox step designs
  - **Issue**: `design-8-crews`, `design-9-conditions` and `design-10-inventory`
    show 1, 3 and 2 gaps in the action matrix, mostly "doing it again does
    nothing", and none has a brief to say which are meant.
  - **Goal**: A `<n>-<name>.brief.md` beside each design in `config/debug/designs/`,
    with its "Nothing on purpose", and a fix for any gap that is not meant, so
    `node scripts/checkLevelDesign.js --all --matrix` exits 0.
  - From: Level Design Config
- [ ] Try the `level-design` skill in Copilot and Codex
  - **Issue**: The skill was tried by agents in Claude Code only; Copilot CLI and
    Codex were not installed where it was built. Both read the same `SKILL.md`
    format, from `.github/skills/` and `.agents/skills/`.
  - **Goal**: `npm run skills -- copilot` and `-- codex`, describe a level in each,
    check what it writes with `node scripts/checkLevelDesign.js <test> --matrix`,
    and fix anything in `skills/level-design/` that one agent reads differently.
  - From: Level Design Config
- [ ] Friendly and neutral characters in a design
  - **Issue**: `characters.friendly` and `characters.neutral` are reserved and
    must be `false`; `assets/characters/friendly/` and `neutral/` are empty.
  - **Goal**: Spawned like enemy groups, with what they do (talk, follow, flee)
    set in the design, and reports a design can wait on.
  - From: Level Design Config
- [ ] Doors that open when someone comes out
  - **Issue**: A design can now slide a door open with `"animate-layers"` (the
    warehouse door does), but only when a state says so; a door with nothing
    written for it stays shut while enemies and the player walk through it.
  - **Goal**: Optional open-door art (`objects/<door>_open.svg`, drawn over the
    `ENTER-` layer like breakable state art), or the door's own layers moved,
    shown while anyone walks out of or into it.
  - From: Level Design Config
- [ ] Art: split the warehouse door's `door-frame-inner` into a half per pane
  - **Issue**: The glass and handles slide apart when the gate breaks, but the
    centre bar is one shape over both panes, so it stays in the open doorway.
  - **Goal**: `door-frame-inner-left` and `-right` (or the bar drawn into each
    pane's group), moved with their pane in `level-design.json`.
  - From: Level Design Config
- [ ] `svg` actions that show and hide layers by path
  - **Issue**: `"svg"` only marks a state (`loads`, `layer-state-change`) or
    fades; a design cannot change the art itself, such as a light going out.
  - **Goal**: `"show"` and `"hide"` lists of layer paths in a state, cut out of
    the background like breakables so they can be toggled.
  - From: Level Design Config
- [ ] `scripts/newLevel.pl`: start a level from one command
  - **Issue**: A new level means creating four folders and two files by hand,
    named to match each other exactly.
  - **Goal**: `perl scripts/newLevel.pl <name>` creates `assets/levels/<name>/`
    with `objects/` and `enterables/`, a starter
    `config/levels/<name>/level-design.json` with its `$schema` line, and a
    sandbox test entry, then says what to draw next.
  - From: Level Design Config
- [ ] Automated tests for the level design code, run in CI
  - **Issue**: The validator, draft migration, suggestions and director were
    checked by hand-run headless browser pages kept in the git-ignored `.tmp/`
    (now also crews, conditions, the inventory, the item screen, the command line
    and the real `theStreets` file, played through its doors). In the repository,
    `scripts/checkLevelDesign.js --all --matrix` runs the validator and the action
    matrix in node for every sandbox test, and `scripts/checkLevelDesignVocab.js`
    checks the vocabulary, the schema and the `level-design` skill; nothing runs
    them on a push.
  - **Goal**: `node` tests for `validateLevelDesign`, `migrateLevelDesign` (with
    `config/debug/designs/5-draft.json`), `levelDesignClosest`, the condition
    parser, `Inventory` and the command line's parser, plus a headless run of each
    sandbox step's checklist, all run by a workflow on every push, with the two
    check scripts above.
  - From: Level Design Config

---

## 11. Documentation Site

> Keep the docs and the demo published and true to the code. The site's design
> is in [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md); its build is
> `.github/workflows/pages.yml` with `scripts/stageDocs.js` and
> `scripts/checkAssetCase.js`. Getting it live is under
> [Documentation Site](#documentation-site) in Current.

Intent: the docs never describe a game that no longer exists.

- [ ] Keep the docs in step with the code
  - **Issue**: Every change to a layer name, a design key or an asset rule makes
    a page wrong until someone notices.
  - **Goal**: Changes that touch `js/level/`, `config/schema/` or the asset
    loaders update their page in `docs/` in the same commit, as
    `.github/instructions/update-docs-on-code-change.instructions.md` asks, and
    `CHEATSHEET.md` with them.
  - From: version.control = null
- [ ] Check heading anchors in the site build
  - **Issue**: `scripts/stageDocs.js` fails the build on a link to a missing
    file, but a link to a missing heading (`level-design.md#players`) still
    publishes.
  - **Goal**: The staging script also checks every `#anchor` against the
    headings of the page it points to, using the same id rules as the site's
    Markdown.
  - From: version.control = null
- [ ] A short clip or screenshot of the demo on the docs home page
  - **Issue**: The docs home page is all text; nothing shows what the game looks
    like or what a level design does.
  - **Goal**: One image or short clip, captured from the game itself (the
    sandbox's `level-design` test: the gate breaking, the crew walking out), on
    `docs/README.md`, with alt text.
  - From: version.control = null
- [ ] Move the Illustrator script docs into `docs/`
  - **Issue**: `scripts/README.md` is the one guide not on the site.
  - **Goal**: `docs/asset-scripts.md`, with a quickstart and a cheatsheet, a menu
    entry, and `scripts/README.md` reduced to a pointer.
  - From: version.control = null

---

## 12. Bug Fix Running List

> Bugs found in play that were too large to fix on the spot, or that touched files
> other work had open. Each item says what goes wrong, where in the code, how to see
> it, and what proves it fixed.

Intent: patch-sized fixes; nothing here changes a format or a public name.

- [x] **User only**: `player-run`: holding Shift to run plays the run animation but the player crosses the level no faster than walking
  - **Issue**: In `Player.update` (`js/entities/player.js`, the grounded branch of
    the Movement block) `run` (Shift) is read only to choose the animation state
    (`runstart`, `run`, `runstop`, `walk`) and to set `isRun` for the running kick.
    The velocity is set from `CFG.playerSpeed` alone (`vx = +/-CFG.playerSpeed`,
    `vy = +/-CFG.playerSpeed * 0.6`) whether Shift is held or not, and
    `Entity.moveXY` (`js/entities/entity.js`) applies it unscaled. There is no run
    speed in `CFG` (`js/core/config.js`) at all, though the comment in that block
    ("speed still changes on the same frame the key is pressed") expects one. So a
    run is the walk at 220 px/s with faster legs (`playerRunFPS` 12 against
    `playerWalkFPS` 5).
  - **Goal**: Running moves the player across the level noticeably, but only
    slightly, faster than walking. Add a multiplier to `CFG` in
    `js/core/config.js` under Movement, for example `playerRunSpeed` ("run speed
    as a multiple of playerSpeed"), and in `Player.update` scale the grounded
    `vx` (and `vy`, if decided below) by it when `run` is held. Expose it in
    `js/ui/debug.js` under `PLAYER MOVEMENT` beside `playerSpeed`, with a label
    that does not clash with the enemy section's `Run Speed ×` (`enemyFleeSpeed`),
    for example `Player Run ×`. `config/configuration.json` and its copy in
    `config/defaults/` need no edit for it to work, since a key they lack keeps
    its built-in value, but a debug export will write it there.
  - **Decide first**: how much faster, and in which directions. (a) The multiplier:
    1.3 reads as "slightly noticeable" at 220 px/s (286 px/s), 1.5 is a clear
    sprint (330 px/s). (b) Whether running also speeds up the up and down depth
    movement, or only left and right. (c) Whether a jump started from a run keeps
    the run speed in the air (air strafe in the same block uses
    `CFG.playerSpeed * CFG.playerAirControl` and would stay at walk pace unless
    changed). A faster run also carries the player further into a running kick,
    so `runningKickRange` may want a look afterwards.
  - **Repro**: any level or sandbox test. Hold Right for two seconds, then hold
    Right with Shift for two seconds from the same spot: the camera and the
    player cover the same ground both times.
  - **Done when**: a headless page under `.tmp/` (the pattern of
    `.tmp/response-check.html`) places the player on open ground, holds
    `ArrowRight` on `window` for 60 steps of `update(1 / 60)` and reads `player.x`,
    then resets and holds `ArrowRight` with `ShiftLeft` for 60 steps: the run's
    distance is the walk's times the chosen multiplier (both are 220 px today);
    every sandbox test keeps its status (`node scripts/checkLevelDesign.js --all`)
  - **Waited because**: triage row 5, one right answer: the run speed is game feel
    (a speed), so the owner picks the multiplier and whether it applies to depth
    and air movement. The change also spans `js/core/config.js`,
    `js/entities/player.js` and `js/ui/debug.js`, a new `CFG` key the debug export
    writes to the config files.
  - **Evidence**: `.bug-fix/gifs/player-run.gif` (local only; two recordings side
    by side, walking on top and running below, over 4.2 s: from about 1.9 s both
    move right, and the red car and lane lines scroll past at almost the same rate,
    the running one only about 45 px further along by 3.7 s)
  - From: Bug Fix Running List
- [x] **User only**: `Add`: a render debug mode, since there is no way to look at a level design's recolored character frames one by one, outside of play
  - **Issue**: A level design's pool entry can recolor an enemy
    (`{ "enemy": "JumpingJunkie", "render": { "left-vest": "gray" } }`), but the
    only way to see the result is to play: the `design-7-render` sandbox test
    spawns the crew and they walk, attack and fall at game speed, so a frame that
    stays as drawn (CrimeGuy's `_attack`, `_preDefeat` and `_defeat`, which name no
    vest layer) flashes past, and the console warning from `variantFrameText` in
    `js/sprites/variants.js` is the only record of it. Nothing is broken: the view
    does not exist. The parts it would build on are all there:
    `levelDesignEnemyVariants(design)` in `js/level/level-design.js` lists every
    `{ enemy, render }` a design's pools and groups draw, `enemyVariant(enemy, render)`
    in `js/entities/enemy.js` registers it, `enemyCharImages(charKey)` in
    `js/sprites/enemies.js` gives its decoded frames, and `variantFrameText` /
    `renderSvgVariant` in `js/sprites/variants.js` say which parts a frame is missing.
  - **Goal**: A debug view that draws, still and side by side, every frame of every
    animation of each character a level design recolors, next to the same frame as
    drawn, with the frame's file name and any part it has no layer for written under
    it. No player, no enemies moving, no level logic: read the design, register its
    variants as the sandbox already does (`_sandboxVariantImages` in
    `js/ui/sandbox.js`), wait for the images to decode, and draw them in a grid on
    the canvas. Picking a design reuses the sandbox's list.
  - **Decide first**: where the view lives and what it covers.
    - Where: (a) a new sandbox test kind, such as `"view": "renders"` on an entry in
      `config/debug/sandbox.json`, which changes that file's format and its schema;
      (b) a new focus mode in the debug panel (`_DEBUG_FOCUS_ROWS` and
      `_renderFocusContent` in `js/ui/debug.js`) that pauses the game and draws the
      grid over it; or (c) a standalone page under `docs/` or `config/debug/` that
      loads the scripts and needs no game at all.
    - Which designs: the chosen sandbox test's design only, or every
      `config/levels/<level>/level-design.json` and `config/debug/designs/*.json`.
    - Which characters: enemies only (the only ones with a render today), or the
      player too, once the outfit select under Asset Scripts exists.
    - Layout: every frame of every animation, or one chosen animation stepped a frame
      at a time with the arrow keys; with the as-drawn frame beside it or not.
  - **Repro**: start the `design-7-render` sandbox test (SANDBOX TEST menu) and try to
    see the gray JumpingJunkie's `defeat` frames: they only show for a moment when he
    is beaten.
  - **Done when**: the view opens for `design-7-render` and for `theStreets`, shows
    each variant's frames recolored beside the originals, and names the frames that
    keep a part as drawn (the gray CrimeGuy's `_attack`, `_preDefeat` and `_defeat`
    vest); a headless check loads the view, waits for decode and reads one pixel of a
    recolored part per variant; every sandbox test keeps its status
    (`node scripts/checkLevelDesign.js --all`)
  - **Waited because**: it is a new feature, not a defect, and where it lives and what
    it shows are the owner's choice (triage row 5); any of the options also needs a
    new file, a new UI or a `sandbox.json` format change (row 6)
  - **Evidence**: none
  - From: Bug Fix Running List
- [x] **User only**: `foreshortening`: a character walking behind the parked red car is drawn over it, so they look like they walk on top of the car
  - **Issue**: Since the `negative-space` fix, the player can walk the thin sidewalk
    strip behind the parked red car on theStreets (feet at world y 359.5, while the
    car's hole spans x 690 to 967, y 363.6 to 398.4). The car should hide the
    player's legs there, but it is drawn under them. The car is static art: the
    `vehicle-red-i` group in `assets/levels/theStreets/level-theStreets.svg` is baked
    into the scene's background image (`_svgSceneBackground` in
    `js/level/svg-scenes.js` drops only the ids in the map's `stripIds`, which
    `parseLevelMap` in `js/level/level-map.js` fills with ANIMATE, BREAKABLE and
    INVENTORY pieces). `draw()` in `js/rendering/draw.js` paints that background
    first, then depth-sorts only enemies, the player, breakables and world items by
    their feet. No piece of static art takes part in the sort, so every character is
    drawn in front of the car wherever they stand. Nothing in the map ties the car to
    its hole either: the `negative-space` rect is the sibling just before
    `vehicle-red-i` in the file, not inside it.
  - **Goal**: Art that stands on the ground (the car first) is cut out of the
    background and drawn in the depth sort, so a character whose feet are behind its
    front edge is drawn under it, and one in front of it is drawn over it. In
    `parseLevelMap`, for each piece of such art: push its id onto `stripIds`, make a
    sprite with `_levelMapSpriteMarkup` (as breakables do), and record it with a
    depth line in world y; leave it out of every moving-layer slab too (the `skip`
    set `_levelMapMovingLayers` passes to `_levelMapSlab`), or the door's slab could
    paint part of it back over the characters. Load the sprite where breakable
    sprites are loaded (`js/entities/level-objects.js`) and add it to the list
    `draw()` sorts, keyed by its depth line, with `cam.x` applied as the background
    does. With the depth line at the hole's bottom edge (y 398.4), the player at
    y 359.5 draws behind the car and one at y 410 in front of it.
  - **Decide first**: (1) Which art draws in the depth sort. (a) Automatic: the
    element right after each `negative-space` in the file (here `vehicle-red-i`),
    no renaming and no new vocabulary, but it relies on layer order, and art over a
    flat hole (a pit, a puddle) is cut out too. (b) Automatic by nesting: the group a
    `negative-space` sits inside, which means moving the car's hole into
    `vehicle-red-i` in the SVG (art). (c) A new map name for art that stands on the
    ground (for example a `DEPTH-` prefix), which also covers art with no hole
    (lamp posts, the "foreground overlay elements" item under Background Elements),
    but adds to `LEVEL_MAP_RULES`, `docs/level-naming.md` and
    `scripts/checkLevelDesignVocab.js`, and the owner renames layers. (2) The depth
    line: the hole's bottom edge, or the bottom of the art's own box (the tyres).
    They agree for this car and can differ for other art.
  - **Repro**: sandbox test `level-mapping` (The Streets). Walk right past the
    warehouse door, then up onto the sidewalk strip behind the parked red car and
    along it: the whole player is drawn over the car's body and wheels.
  - **Done when**: a headless check under `.tmp/` that wraps each sorted item's
    `draw` to log the order shows, with the player's feet at y 359.5 and x inside 690
    to 967, the car drawn after the player, and with the feet at y 410 the player
    drawn after the car; enemies sort the same way; the car still shows where it did
    when no one is near it; every sandbox test keeps its status
    (`node scripts/checkLevelDesign.js --all`), and
    `node scripts/checkLevelDesignVocab.js` reports the same as before (or lists the
    new name, for option (c))
  - **Waited because**: triage row 5, one right answer: which art joins the depth
    sort, and by what line, is a naming and behavior choice for the owner (and option
    (b) is an art change). Row 9 would fail too for now: `docs/level-naming.md`,
    which describes `negative-space`, has uncommitted work from another task
  - **Evidence**: `.bug-fix/gifs/foreshortening.gif` (local only; 16.7 s, debug
    overlay on: at about 1.5 s, 4.5 s and 6 s the player walks along the strip behind
    the red car with their legs and feet painted over its hood and wheels, and at
    about 7.5 s and 9 s, below the car, they are correctly in front of it)
  - From: Bug Fix Running List
- [ ] **User only**: `Update`: the "Local Weather" mode always shows the same night storm (rain, clouds, lightning) instead of the weather where the player is
  - **Issue**: Nothing in the game reads real weather. The weather layer in `js/rendering/weather.js` (`drawWeatherSky()`, `drawWeatherFront()`) only reads fixed `CFG` keys from the `Local weather` block of `js/core/config.js` (`weatherNight`, `weatherTone`, `weatherPrecip`, and the rest), which `config/configuration.json` and `config/defaults/configuration.json` overlay with `night` / `hot` / `stormy`. No script calls a weather service (the only network calls are the sprite, item, sequence and level loaders), so the "Local Weather" toggle (`dbg-weather` in `js/ui/debug.js`) can only switch that one storm on or off. The renderer also has no day or snow art: `js/sprites/weather.js` loads only `cloud.svg`, `rain.svg` and `moon.svg` from `assets/levels/weather/`, and its own comment says a day render needs `sun.svg` and a cold render needs `snow.svg`, neither of which exists.
  - **Goal**: When local weather is on and the player is in the US, ask `https://api.weather.gov` for the current conditions at the player's location (`/points/{lat},{lon}` gives the forecast and observation station URLs; the first period of the hourly forecast, or the latest station observation, gives temperature, `isDaytime` and a short forecast text) and map them onto the existing keys: `weatherNight` from `isDaytime`, `weatherTone` from the temperature, `weatherPrecip` from the forecast text (rain or thunder to `stormy`, clouds or overcast to `cloudy`, clear or sunny to `sunny`), following the directive table already used for the weather layer. Outside the US, or when the request fails or there is no location, keep today's rainy storm. A small new script (for example `js/core/local-weather.js`, loaded before `js/rendering/weather.js` in `index.html`) would fetch once at start, set the `CFG` keys and leave the render code as it is; `js/sprites/weather.js` and `js/rendering/weather.js` then need `sun.svg` and `snow.svg` drawn for day and cold renders.
  - **Decide first**: (1) Where the location comes from: browser geolocation (asks the player for permission; denied means the rainy fallback), a third-party IP lookup (no prompt, but sends the player's IP to another service), or a lat/lon the owner sets in `config/configuration.json`. (2) How "not in US" is decided: a 404 from `/points/{lat},{lon}` (api.weather.gov answers only for US points, so no extra service is needed), or a country field from the IP lookup. (3) The temperature bands for `hot` / `medium` / `cold` (for example below 45 F cold, above 80 F hot). (4) Whether the art for a day sky (`sun.svg`) and snow (`snow.svg`) is added first, or day and cold renders ship without a sun and with rain until it is. (5) Whether `CFG.weather` still defaults to on (the `Turn` item asks to turn local weather off by default). Note that a browser cannot set the `User-Agent` header api.weather.gov asks clients for, so requests go out with the browser's own.
  - **Repro**: start the game at any stage with local weather on (debug panel, "Local Weather" checked): the sky is always night with storm clouds, heavy rain and lightning, whatever the real weather is.
  - **Done when**: with a stubbed `fetch` in a headless page under `.tmp/` returning a sunny daytime forecast for a US point, the `CFG` weather keys read day / sunny after start; a stubbed 404 (a point outside the US) and a rejected request both leave `night` / `stormy`; `node --check` passes on each changed script; every sandbox test keeps its status (`node scripts/checkLevelDesign.js --all`)
  - **Waited because**: triage row 4 (art): a live day or cold render needs `sun.svg` and `snow.svg`, which are not in `assets/levels/weather/`; and row 5: the location source, the US test and the temperature bands are the owner's choices. It would also exceed row 6 (a new script and a change to `index.html`'s script order) and row 9 (`js/core/config.js` and `js/ui/debug.js` had uncommitted work from the `player-run` fix)
  - **Evidence**: none (no GIF or image was attached; the behavior is read from the code)
  - From: Bug Fix Running List

---

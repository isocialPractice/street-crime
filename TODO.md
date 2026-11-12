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
- [ ] Handlers for the planned layer names
  - **Issue**: `INVENTORY-`, `MISSING-`, `SWITCH-`, `USABLE-` and
    `REQUIRE-item-` are recognised and warned about, but do nothing. (`ENTER-vehicle`
    is tracked under [Level Map](#level-map).)
  - **Goal**: An inventory the player carries between states, items picked up
    from `INVENTORY-` objects and used on `MISSING-` ones, `SWITCH-` objects that
    set cases, `USABLE-` objects that can be carried but not stored, and
    `REQUIRE-item-` locks; each reporting an event a design can wait on, as the
    draft in `.support/DRAFT_docs-level-naming.md` describes.
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
    checked by hand-run headless browser pages kept in the git-ignored `.tmp/`;
    only `scripts/checkLevelDesignVocab.js` is in the repository.
  - **Goal**: `node` tests for `validateLevelDesign`, `migrateLevelDesign` (with
    `config/debug/designs/5-draft.json`), `levelDesignClosest` and the vocabulary
    against the schema, plus a headless run of each sandbox step's checklist, all
    run by a workflow on every push.
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

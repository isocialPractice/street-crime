# Changelog

All notable changes to Street Crime are documented in this file.

Versions use a dated format, `[YYYY.MM.DD]`, matching the date the work landed on
`main` (for example `[2026.09.08]`). History below starts at `2026.08.10`; for
anything earlier, see the commit log.

---

## [2026.10.17]

### Added
- **`scripts/renameSelectedLayers.jsx`**, moved in unchanged from the
  git-ignored `userScripts/`. It renames whatever is selected in Illustrator
  from one pattern: `#` for a padded sequence number, `*` for the current
  name, and an optional `,N` start number, so `walk_##` gives `walk_01`,
  `walk_02` and so on. It is interactive, run from File > Scripts, and asks for
  the pattern; usage is in `scripts/README.md`.

---

## [2026.10.19]

### Added
- **Reset to Defaults in debug mode, backed by `config/defaults/`.** The
  folder holds `configuration.json`, `enemies.json` and `objects.json` as the
  game ships them, copied from the live files as they stood on 2026.10.19.
  Exports keep writing the live files in `config/` and never touch these, so
  they stay a known-good starting point however far a session's tuning goes.
  - **Reset All to Defaults**, under Export All in the right panel, puts every
    value back: the built-in values from `js/core/config.js` with the three
    default files laid over them in boot order, so it lands exactly where a
    fresh start with untouched files would. The debug flags (infinite health
    and the like) go back too.
  - Each Debug Focus mode has **Reset Player / Enemy / Object to Defaults**
    under its export button, for just the sliders that mode shows.
  - Both take two clicks, since a reset throws away whatever was tuned since
    the last export: the first turns the button red and asks, and it goes back
    on its own after three seconds.
  - Both panels are rebuilt afterwards so every slider and checkbox shows its
    value, and the line under the button says how many values were reset. A
    default file that cannot be read is named there in red, and its keys fall
    back to the other default files and the built-in values.
  - To make the current tuning the default, export it and copy the file into
    `config/defaults/`.
- **`config/levels.json` sets the order a run goes in.** The sequence names
  each level and where it comes from:

        { "sequence": { "level-1": "svg-scenes", "level-2": "svg-scenes" } }

  The key is the level's place in the run. `"svg-scenes"` means the built-in
  table, where level N is the Nth entry of `STAGES` in `js/level/data.js` in
  the order they are written, so adding a stage there adds a level here. Any
  other value names a folder under `assets/levels/`. The three stages that
  exist are mapped; `theStreets` is deliberately not wired to a level yet.
- **A run that asks for a level the game cannot produce now says so.** Writing
  `"level-4": "svg-scenes"` does not create a fourth stage, and the run used to
  just stop after the third with nothing said. Beating level 3 with that in the
  config now shows: *LEVEL 4 IS MISSING. config/levels.json asks for level 4
  from "svg-scenes", but js/level/data.js defines 3. Add a stage to STAGES, or
  drop "level-4" from the sequence.*
  - A level pointed at a folder reports that loading one is not written yet,
    rather than leaving a configured level quietly doing nothing.
  - Both use their own `sequencegap` game state rather than `stageclear`,
    because Enter on `stageclear` calls `advanceStage()` and there is no stage
    to advance into. From a gap it starts a new game.
  - A key that is not `level-<number>`, or a value that is not a name, is
    dropped with a warning. Silently ignoring one would shorten the run by a
    level and look like a bug somewhere else.
  - With no sequence configured at all the run falls back to the stages as
    written, which is what the game did before the file existed.

### Changed
- **The three config files are read by one helper.** `game.js` used to repeat
  the same synchronous read for each; `applyCfgFiles()` in
  `js/core/config.js` now reads `CFG_FILES` in order, which is also what the
  reset reads its defaults with. Startup behaves as before.
- **The storm clouds hang from the top of the level.** A little over half of
  every cloud (52 to 62 percent, varied per cloud) now sits above the top
  border, so only the underside of the bank shows, like a low ceiling, instead
  of whole clouds floating in the sky.
- **The rain is less uniform.** Each drop leans slightly off the wind slant
  (up to about 3.5 degrees either way), is a little wider or narrower and
  longer or shorter than its neighbours apart from its depth, and lengthens
  slightly as it falls. The amount of rain also eases and swells between 65
  percent and all of `weatherRainCount` over slow, irregular spells, leaning a
  touch harder in the heavier ones. Drops fade in and out as it changes rather
  than popping, and the ground splashes follow the same amount. The values
  are `WX_RAIN` in `js/rendering/weather.js`.
- **Each level's artwork lives in its own folder.** `assets/levels/enterables/`,
  `assets/levels/objects/` and `level-theStreets.svg` moved under
  `assets/levels/theStreets/`, so a level's pieces sit together and a second
  level does not have to share folders with the first.
- **The empty `levels/` at the repository root is gone.** Its one file had
  already moved under `assets/levels/`, and git never tracked the folder, so
  removing it leaves nothing to stage.

---

## [2026.10.18]

### Added
- **SANDBOX TEST, a fourth entry on the title menu.** A debug harness for
  trying one feature at a time, set up in `config/debug/sandbox.json` rather
  than in code. `"tests"` holds named setups (a level folder and scene, where
  the player spawns, `CFG` values to override, enemies to spawn and a
  checklist), and `"active"` picks the one the menu starts.
  - The left debug panel gains a block on top: a picker for the tests, RESTART
    (which reads the file again, so a test can be edited and rerun without a
    reload), a status line, and the checklist, whose rows tick as the features
    report in.
  - The first test, `level-mapping`, loads `assets/levels/theStreets/` and
    waits for four things: the BAD BAR sign animating, the parking gate arm
    breaking, and the Bad Bar being entered and left.
  - A missing or broken file, an unknown test, or a scene that cannot be read
    runs a built-in test of `theStreets` instead, with the reason in red on
    the status line. A sandbox that will not start tells nobody anything.
- **Level map: what a level does, from how its layers are named.**
  `js/level/level-map.js` reads the ids in a level SVG and measures each one
  where the browser lays it out, so transforms and the viewBox are taken into
  account. The README's *Level Map Ids* table has the full vocabulary.
  - `ANIMATE-<asset-name>` is drawn from frames `<asset-name>_0.svg`, `_1`, ...
    in the level's `objects/` folder, lined up on the layer it replaces and
    played `loop` or `yoyo` (`CFG.levelAnimateMode`, `levelAnimateFPS`, or the
    test's `levelMap.animate`). It keeps moving while paused. A missing frame
    set leaves the layer in the background with a warning, so missing art
    never vanishes.
  - `BREAKABLE-<name>` is cut out of the scenery into a `LevelBreakable`: it
    blocks movement, takes `objBreakHits` blows, jolts on each, and bursts in
    splinters of its own paint colors. It can be hit from anywhere along the
    depth it covers, which for the gate arm lying across the lane is most of
    the street.
  - `negative-space` is a hole in `#field`. Movement and spawning both treat
    it as off limits, for the player and enemies alike, with the usual
    `fieldBorderPadding` clearance.
  - `ENTER-<type>` inside `ENTERABLE-<name>` is a door. E, or pushing into it
    with Up for `CFG.enterHoldTime`, fades through to the interior
    (`enterables/<name>.svg`, or the camelCase name). The scene left behind
    keeps its enemies, breakables and pickups for the way back. An interior
    with no `ENTER-exit` is left by walking into its left edge. A door that
    cannot be used, such as a `vehicle` (recognised, not built yet) or one
    with no interior, says so instead of doing nothing.
  - With Show Hitboxes on, every map entry is outlined and labelled with its
    id, and the sandbox prints them as a table, with warnings for ids that
    look like typos (`ANIMTE-sign`), a building with no door, or a hole that
    reaches outside the field.
  - Features report through one event bus, `LEVEL_MAP_EVENTS`, as
    `animate:`, `break:`, `enter:`, `exit:` and `interact:` events, which is
    what the sandbox checklist listens to.
- **Enemies rushing the player walk around a hole** rather than pressing
  against it for good: `stageHoleWaypoint()` aims them at a corner of the hole
  on whichever side is open. Movement already slid along the field's own
  edges, but a parked car with the player straight across it left an enemy
  pinned.
- **LEVEL MAP sliders in the debug panel's Object focus:** door reach, push
  time, fade time and animation fps, exported with `objects.json`.

### Changed
- **Border rects are matched by exact name.** Only `border`, `border-2` and
  so on slice a level into screens and are stripped from its image. The old
  test matched any id containing the word, which in `theStreets` would have
  deleted the sidewalk's `tile-borders` cracks along with them.
- **A level with no `section_<n>` groups takes its screens from its border
  rects**, ordered left to right rather than by id, since Illustrator numbers
  a copy after the original. `theStreets` is two screens, 1600 px of world.
- **Enter after a game over restarts the debug mode you were in.** DEBUG LEVEL
  used to drop into the DEBUG MODE arena; each debug start now sets
  `debugRestart` to itself.
- **SPAWN OBJECT keeps the level's own breakables** and replaces only the last
  spawned crate, so in the sandbox it no longer deletes the gate arm.
- Whether a blow reaches a breakable in depth is now the breakable's to answer
  (`inHitDepth`). Crates keep exactly the old rule.
- **Assets are filed by what they are.** 413 files moved out of the flat
  `assets/` into a tree, every one with `git mv` so the rename is staged and
  the history follows rather than reading as a delete and an add.
  - `assets/characters/player/` takes the 70 `Player_*` files and
    `assets/characters/enemy/` the 331 character files, beside the empty
    `friendly/` and `neutral/` waiting on artwork.
  - `assets/objects/` takes the nine `Object_*` files, the crates, the health
    pickup and the hit effects.
  - `assets/weather/` is now `assets/levels/weather/`, the weather being part
    of a level's scenery.
  - Only the two Windows shortcuts to the source artwork stay at the top.
- **`_enemyAssetPath()` routes by name.** Nearly everything it resolves is
  enemy artwork, but not quite: the player animations an enemy swaps in through
  `apply<State>` are the player's own sprites, named by the enemy config and
  loaded by that module. A base beginning `Player_` resolves against the player
  folder, everything else against the enemy one, and a base already written as
  a path is still taken as given, which is what the `files` form relies on.
- `js/sprites/player.js`, `objects.js` and `weather.js` point at the new
  folders, and the module documentation in `js/sprites/enemies.js` names them.

### Fixed
- **The level scene pointed at an empty folder.** `SVG_SCENES.testItWorked`
  loaded `levels/Test_ItWorked.svg` from the repository root, but the file had
  already been moved under `assets/levels/` by hand, leaving the root `levels/`
  empty. It now loads `assets/levels/Test_ItWorked.svg`.
- **A `.gitkeep` would not have survived a clone.** A global ignore of dotfiles
  is common enough, and one is in force here, so the markers holding the empty
  folders open were invisible to git. `.gitignore` now un-ignores them, which
  keeps the checkout whole without depending on anyone's personal config.

### Notes
- The BAD BAR sign is set in Myriad Pro, which browsers do not have. The
  fallback font is wider, so each frame's viewBox is widened to fit what it
  draws; without that the R was cropped. Outlining the text in Illustrator
  would make the sign look the same everywhere.
- `#field` in `level-theStreets.svg` runs to x 13113, far past the 2915-unit
  drawing. Movement clamps to the world, so it plays, but the debug overlay
  draws past the end.
- `enterables/badBar.svg` is still a copy of `Test_ItWorked.svg`, standing in
  for the bar's interior.
- The gate arm does not seal the parking lot: there is room to walk past it
  above (from the warehouse step at x 1065) and below.

---

## [2026.10.12]

### Added
- **A `yoyo` animation mode.** The frames run forward and then return, without
  either end repeating, so five frames make an eight step cycle
  (`0 1 2 3 4 3 2 1`) and the step after it is `0` again. It is the ping-pong
  that walk cycles were already being written out by hand as, with the return
  half inferred instead of spelled, so a set drawn as a half cycle lists its
  frames once.
  - Rate is read exactly as `loop` reads it, an explicit fps or one whole cycle
    across a duration, so the two are interchangeable wherever a state is
    played.
  - `SassyGirl` is the first to use it. Her walk was eight suffixes with three
    of them repeats; it is now five, and plays the identical cycle frame for
    frame, which is checked against the old list over three full cycles.
  - The modes are now written up together at the top of `js/sprites/enemies.js`:
    `hold`, `loop`, `sequence` and `yoyo`, and that an unrecognised mode is
    treated as `hold`.

### Notes
- `SassyGirl`'s walk keeps its suffixes written out rather than taking the bare
  `"walk"` form. Her numbered run starts at `walk_1` and the numbered-range rule
  begins at `_0` and stops at the first gap, so the bare form resolves to
  nothing for her: it leaves her walking on the single base pose and warns. The
  bare form is fine for a character whose run starts at `_0`, which is what
  `GreenJetter` and `TightRomper` do.
- Three other walks are still hand-written ping-pongs that `yoyo` would shorten
  in the same way: `BadGirl`, `JammingJabber` and `JumpingJunkie` all carry
  `["", "walk_1", "walk_2", "walk_1"]`, which is `yoyo` over the first three.
  Left alone, since only `SassyGirl` was asked for.

---

## [2026.10.11]

### Changed
- **Stage 1 has a new sub-boss and a new boss.** `BadOne` takes the sub-boss
  slot and `SquirrlyGambler` steps up from it to boss, displacing
  `MaskedMayhem`, which stays on as the boss of stage 2.
  - `BadOne` was the one enemy in the game that no stage could spawn. It had a
    full character set wired up on `2026.10.06` and thirty four frames of
    artwork with nowhere to appear; the debug arena was the only way to see it.
    Every enemy defined now reaches the field.
  - The `mini` and `boss` flags moved with the slots, since those are what the
    roles are made of: they drive the health bar drawn over the head, the
    distance the character stops at, how many may rush at once, and how often
    it swings. `BadOne` gains `mini`, `SquirrlyGambler` trades `mini` for
    `boss` and so swings on the 1.1s boss cooldown rather than the 1.5s
    sub-boss one. Its get-up is untouched, so it still opens with the kick and
    comes back throwing fire.

### Added
- **GreenJetter is wired up** and out of `wipEnemies`, which leaves thirteen
  characters still on the bare defaults. Stage 2's sub-boss now has artwork for
  everything it does rather than fighting on its one standing pose.
  - `idle` is a six frame loop led by the base sprite, `walk` a three frame
    cycle, and `attack` is the four frame wind-up assembled in front of the five
    frame rising kick, the way `SquirrlyGambler` assembles its own. Seven frames
    of hit reaction, four of collapse and three on the floor.
  - Both cycles close: measured as the pixel difference between consecutive
    frames, the wrap back to the first frame is in line with each cycle's own
    typical step, so both play straight through rather than ping-ponging.
  - Its frames are the first to arrive named `idle` rather than `ideal`, so this
    is also the first character the config addresses by the state's real name.
    The six wired up before it still use the old spelling on disk.

### Changed
- `GreenJetter_defeat.svg` was renamed to `_defeat_0` as the first frame of its
  run. Nothing in the config was needed for that beyond the entry above: a
  literal always beats an inferred run, so removing the literal is what lets the
  numbered rule pick the run up.

---

## [2026.10.10]

### Added
- **`scripts/mapSelectLayers.jsx`.** Selects the items a layer map renames,
  in a document that is already open, without renaming anything. It shows in
  Illustrator which paths `mapLayers.jsx` is about to touch, or already has.
  - It works both before and after a run: a container fitting `current` reports
    `renames to <name>`, and one fitting `change` reports `already mapped`.
  - From the command line it only works on an open document, the active one
    or `doc=`, and never opens a file. With no document open, it prints a
    one-line error to stdout and changes nothing.
  - From File > Scripts it selects in the active document, and shows an alert
    only when something did not fit or nothing could be selected.

### Changed
- **Shared layer map engine.** The matching code moved out of
  `mapLayers.jsx` into `scripts/lib/layerMap.jsxinc`, which both map scripts
  `//@include`. `mapLayers.jsx` behaves as before.
- **`runAdobeScript.pl` sets `$.runAdobeScript`** in Illustrator around each
  run. A script can now tell a terminal run from a File > Scripts run even
  when no arguments are passed. Before, a no-argument run looked like a menu
  run, so an alert could stop the terminal call until someone dismissed it
  in Illustrator.
- Errors the user can fix, such as an unknown option or a missing map, no
  longer carry a source line number.

---

## [2026.10.07]

### Added
- **Block, held on C.** A new player control and state. The guard is held
  rather than tapped: it comes up while C is down and drops the moment it is
  released, movement and attacks are shut off behind it, and it only covers the
  way the player is facing, so walking into a crowd on block still leaves the
  ones behind free to land.
  - `Player_Block_0` and `_1` play over `blockEnterTime` and settle on
    `Player_Block_hold`, which the guard holds for as long as it is up. A blow
    turned aside shudders the guard between that pose and
    `Player_Block_resist` for `blockResistTime` at `blockResistFPS`, then
    settles back. All four are optional: with none of them on disk the state
    falls back to the idle pose rather than drawing blank.
  - A blocked blow stops before the ordinary hit response, so there is no hurt
    state, no knockback, no invulnerability window and none of the enemy
    reactions an unblocked hit would carry.
- **Block configuration**, in `config/configuration.json` and on the debug
  player panel.
  - `blockForPlayer` and `blockForEnemies` say who can raise a guard at all.
  - `blockNoDamage` is the toggle and wins outright: on, a guarded blow costs
    nothing. With it off, `blockDamageTaken` is read as a 1 to 10 scale against
    the blow's own damage, so a guarded hit tracks whatever the attack hits for
    rather than a flat figure a weak jab and a boss swing would both land for.
    At 3, a 40 damage blow costs 12; at 10 it costs the full 40.
- **Enemy block mapping.** `block` and `blockResist` are now states in the
  `config/enemy-assets.json` defaults, resolving down one ladder whatever
  artwork a character has:
  - `block_hold` and `block_resist` together are the full form: the run plays,
    settles on the hold pose, and shudders against the resist pose.
  - A numbered run on its own plays and holds its last frame, with no resist.
  - A single `<EnemyName>_block.svg` is the guard on its own.
  - Nothing drawn resolves to nothing and the character has no guard.
- **Optional animation states.** An animation declared `"optional": true`
  resolves to nothing without warning, which is what lets `block` and
  `blockResist` sit in the defaults for all twenty five characters while none
  of them have the artwork yet. Every other state saying nothing resolved is
  still worth hearing about, and still does.
- **Layer map script.** `scripts/mapLayers.jsx` renames layers, groups and
  paths in an Illustrator source file from `scripts/data/layerMap.json`.
  Illustrator writes those names out as SVG ids, and named ids are what color
  and outfit changes will key off.
  - The map holds two copies of one tree, `current` and `change`. A key
    matches at any depth, so `Player_Walk > front-glove` reaches the glove in
    every frame without naming the frames. A `layers` list renames a matched
    item's children by position.
  - A list can stop short: `[ "<Path>" ]` renames only a group's first child
    and leaves the rest alone. Nothing is renamed unless every listed child
    matches its `current` entry, so a frame drawn differently is skipped and
    reported. `exact=1` also skips any group whose child count differs from
    its list.
  - `dry=1` previews the renames and `reverse=1` undoes a run.
- **`scripts/runAdobeScript.pl`**, a cross-platform port of
  `runAdobeScript.bat`. It runs a `.jsx` in Illustrator through COM on Windows
  or AppleScript on macOS, passes arguments through, and prints the result.
- **`support/` for source artwork.** Illustrator sources go in `support/`,
  which is git-ignored since they grow large. `source-player.ai` and
  `source-enemies.ai` are force-added as examples for the scripts.

### Notes
- A guard only covers the way its owner faces. The spec did not say either way;
  a guard that worked from behind would be strictly better than moving, so it
  is front-only. `Player._isGuarding` is the one line if that is wrong.
- Nothing raises an enemy guard yet. The artwork path, the config, the drawing
  and the damage rule are all in place and shared with the player, so setting
  an enemy's state to `block` works today, but deciding *when* a character
  should guard is an AI rule that was not specified and has not been invented.
  That and the enemy block artwork are what is left.

---

## [2026.10.06]

### Added
- **NinjaWarriorOfCrime and BadOne are wired up** and out of `wipEnemies`,
  which leaves fourteen characters still on the bare defaults.
  - `NinjaWarriorOfCrime` is a twelve frame sword sequence, `attack_0` through
    `attack_11`: the draw, the slash, the follow-through and sheathing it
    again. Six frames of hit reaction, five of collapse and two on the floor.
  - `BadOne` throws his jacket open to fight. `attackTransition_0` through `_2`
    are the wind-up and lead straight into `attack_0` through `attack_6`, which
    the config assembles into one ten frame swing the way `SassyGirl` assembles
    her `preAttack`. Seven frames of walk, six of hit reaction, four of collapse
    and two on the floor.
- **`anchorWeapon` on NinjaWarriorOfCrime.** Every one of its frames carries a
  weapon layer, sheathed across the back while walking and drawn during the
  attack, and the blade reaches far enough to grow the artboard by half again
  at full extension (116.97 units against 79.78 at rest). Centred, that would
  slide the body backward as the sword came out. The flag is set on the enemy
  directly rather than taken from the `weaponAttack` block, because that block
  also grants a get-up and a `getUp` animation and there are no get-up frames
  drawn for this character: without them the state falls back to `preDefeat`
  and it would play its collapse forward again in place of standing up. This is
  the same reasoning `HyJungScout` is held at `bodyAttack` for, except that
  anchoring can now be had on its own.
  - Measured in the browser, the anchor moves only where it has to:
    `0 0 0 7.7 7.7 7.7 0 0 10.1 0 0 0` across the swing. The non-zero frames are
    the raised-blade wind-ups and the follow-through, the ones where the sword
    reaches behind the body; the forward slash sits at 0 because the body's back
    edge is the artboard edge there, which is exactly what should hold still.

### Notes
- `NinjaWarriorOfCrime_walk_5` is left out of the walk. It renders 0.1%
  different from `walk_0`, which is to say it is the closing repeat of the first
  pose rather than a sixth position, and looping all six would hold that pose
  for two frames every cycle. The walk is the five that move: `walk_0` through
  `walk_4`. The other states take the whole contiguous run as usual.
- BadOne's jacket is open in his idle and walk art but closed through all three
  `attackTransition` frames, then open again from `attack_0`. Read forward it is
  a jacket swinging shut on the wind-up and flying open on the strike, which is
  how it is wired; worth a look if it was meant the other way round.
- The blow lands on `attack_6` for the ninja, its full forward slash, which is
  as good as the shared timing gets. BadOne's lands on `attack_2`, a guard pose,
  because his punch is in the last three frames of ten while `enemyAtkHitDelay`
  falls at 54% of any sequence. An `attackTime` will not move it: the hit delay
  scales with the sequence, by design, so it keeps the same relative position.
  Moving it onto the punch needs the hit anchored to a frame rather than to a
  fraction.

---

## [2026.09.26]

### Fixed
- **Weapon attacks hold the character in place.** Every enemy frame was drawn
  centred, and every artboard is cropped to its artwork, so a frame with a
  weapon out is wider by however far the weapon reaches. Centring it shoved the
  body backward by half of that: SassyGirl slid back out of her own hitbox as
  the taser came out, and SquirrlyGambler's flame attack threw him about 150px
  behind his, before both snapped forward again when the attack ended.
  - Any animation with a frame carrying a layer whose id starts with `weapon`
    is now pinned by the back of the character: the artboard edge the weapon
    points away from is held where the character's reference pose has its own,
    from the first frame to the last. Only the weapon moves.
  - Art faces right and is flipped at draw time, so that is the left edge as
    authored; on an enemy facing left the flip carries it to the right edge.
  - The frames of such a run with no weapon in them, a wind-up or a recovery,
    are pinned too, so the armed frames line up with them.
  - A weapon that reaches behind the body, such as a wind-up over the
    shoulder, does not count towards the back edge. It is measured from the
    body's own artwork instead, so the swing does not drag the character
    forward either.
  - What the weapon reaches now matches what it hits. Power-attack reach was
    already the widest frame's drawn width, but the centred weapon only ever
    showed half of it.

### Added
- **`anchorWeapon`** in `config/enemy-assets.json`. The `weaponAttack` block of
  `attackTypeDefaults` turns it on, so every weapon-fighting enemy, current and
  future, is anchored without restating it. An enemy entry can set it either
  way. HyJungScout draws a `weapon` layer but fights as a `bodyAttack`, so its
  lunge is unchanged.

---

## [2026.09.25]

### Fixed
- **The loading screen no longer appears to freeze.** Startup took 23.6s
  measured from page start to the screen being dismissed, and looked hung
  rather than slow because all of it ran on the main thread: every sprite file
  in the game was fetched over synchronous XHR, one blocking round trip at a
  time, so the page could not repaint for the duration. It is now 3.0s, and
  6 synchronous requests rather than 370.
  - This was not new. The same measurement against the previous commit gives
    18-37s; it had been growing with every asset drop and had simply reached
    the point of reading as a hang.
  - The server was never the problem. It answers in about 12ms a file; Chrome
    charges roughly 48ms for each *synchronous* XHR on top. The same 306 files
    fetched in parallel take 10ms in total.
- **`loadSvgFile()` hands back its Image immediately** and notes the path down.
  Everything noted is fetched in one parallel pass once the document has been
  parsed. The sprite modules keep their plain declarative shape and what they
  hand out is unchanged, since an Image is what they were getting before; it
  fills in a moment later, well before `ASSETS_READY` lets the game start.
  - `loadOptionalSvgFile()` can no longer answer "absent" on the spot, so it
    returns an Image that carries `img.missing` once the batch has settled.
    `dropMissingSvgFiles()` nulls those out for a caller, which is how
    `PLAYER.knockDownPose` still reads as null when there is no artwork.
  - `PLAYER_DAMAGE_FRAMES` and `PLAYER_COLLAPSE_FRAMES` are built when the
    batch settles rather than at evaluation, for the same reason.
  - A file `fetch` cannot deliver falls back to the original synchronous read,
    so opening the game straight off disk over `file://` still works.
- **The enemy build resolves its assets in parallel rounds.** Resolution cannot
  know what an animation is made of without first knowing which files exist,
  and it answers that by fetching, which made it 306 of those 370 requests and
  14.6s of the 23.6s on its own. One round now fetches the literal for every
  base, then one round per frame index: every base still on a run asks for `_0`
  together, whichever of those exist ask for `_1` together, and so on. That is
  the contiguous-run rule turned inside out, costing about as many round trips
  as the longest animation has frames instead of one per file.
  - The build that follows is unchanged and issues no requests of its own, since
    the warm-up fills the same cache the synchronous path reads from. Anything
    the warm-up does not reach still resolves the old way, so none of it is
    load-bearing.
  - `ENEMY_CHARS` is filled in rather than assigned, so every reference already
    held stays valid, and `ASSETS_READY` now waits on the build before it waits
    on the decodes.
- Verified in a headless browser against the real files: 25 characters, 321
  enemy frames and 60 player, object and weather sprites, none undecoded, all
  carrying the authored viewBox size that on-screen scaling depends on, with no
  console errors or warnings.

### Added
- **`attackType` takes a list.** A single name still reads as one name; a list
  is how a character that changes the way it fights declares the order. The
  first entry is what it opens with and each later one is what it brings out
  after being knocked down and standing back up.
  - The list sets the get-up count: one fewer than the number of attacks, since
    the only way to the next attack is to go down and get up again. An entry may
    still state `canGetUp` or `getUps` outright and win, and an enemy with no
    list behaves exactly as before.
  - `attackTypeDefaults` blocks are folded together for every type in the list,
    later types winning, so a character that opens `bodyAttack` and escalates to
    `weaponAttack` inherits the weapon block's get-up wiring without restating
    any of it.
  - `Enemy._attackStage()` is how many times the enemy has stood up and
    `_attackStateKey()` turns that into the animation it swings: stage 0 is
    `attack` and every later stage `powerAttack`, which is the escalation
    `SassyGirl` already had. This replaces the `hasGottenUp` latch, and the
    power-attack reach and the power-attack effect now follow the stage rather
    than being hardwired to one animation name.
- **SquirrlyGambler is fully animated** and out of `wipEnemies`. It is the first
  character to use a list: `["bodyAttack", "weaponAttack"]`, so it gets one
  get-up, opens with an eight frame kick, and comes back throwing flaming dice.
  - The reach falls out of the artwork with nothing to tune. At stage 0 it has
    no power attack, so it closes to 95px and kicks. At stage 1 the thrown dice
    and the fire are drawn 388px out, so it stops there and throws instead, well
    outside the range the player has been fighting it at.
  - `walk` is an eight frame cycle, `attack` is `preAttack` plus the kick,
    `powerAttack` is `preAttack` plus the throw plus the `postPowerAttack` smoke
    drifting away, and `getUp` is its own four frames. `taunt` reuses
    `preAttack`, the way `SassyGirl` does.
- **Player burn reaction.** `SquirrlyGambler` declares `"applyDamage": "Burned"`,
  which resolves to `Player_Damage_Burned_0` through `_9` and plays in place of
  the stock damage reaction. This is the second user of the mechanism added in
  `2026.09.16`, after `SassyGirl`'s electrocution.

### Notes
- `applyDamage` is a property of the enemy, not of the stage, so
  `SquirrlyGambler`'s kick sets the player alight the same way its fire does.
  That is what was asked for and it is what the config can currently express;
  making the burn belong to the `weaponAttack` stage alone would need
  `applyDamage` to be declarable per attack type.
- The reach above includes the `postPowerAttack` smoke, which drifts about 48px
  further than the fire does. Dropping those two frames from the `powerAttack`
  sequence would put the reach at 340px, at the cost of losing the beat where
  the smoke clears.
- `SquirrlyGambler` has no idle frames, so it holds its base sprite where the
  characters finished on `2026.09.22` breathe. Its eleven frame attack also runs
  at the shared pacing, about 45ms a frame, and the blow lands on `attack_2`
  rather than the fully extended kick; `attackTime` would fix both, the way
  `HyJungScout` uses it.

---

## [2026.09.22]

### Added
- **Idle animations for seven characters.** `BadGirl`, `CrimeGuy`,
  `HyJungScout`, `JammingJabber`, `SassyGirl` and `TightRomper` each gained an
  `idle` entry in `config/enemy-assets.json`; `JumpingJunkie` already had one
  and picked its new frame up without an edit. Each is a loop led by the
  character's base sprite and followed by the contiguous run on disk, which is
  the form `JumpingJunkie` was already using.
  - Every one of the seven sets is drawn as a closed cycle, so all seven play
    straight through rather than ping-ponging. Measured as the pixel difference
    between consecutive frames, the wrap from the last frame back to the first
    is in line with each cycle's own typical step for all of them: the widest
    gap is `BadGirl` at 1.3x its step, and the rest sit at or below theirs.
  - The base sprite leads each loop rather than being dropped. It reads as part
    of the cycle in six of the seven, and it is also the frame `_enemyUnitPx()`
    measures a character's on-screen scale from, so keeping it first means no
    character silently resizes. Handing that job to a new first frame would have
    moved `HyJungScout` by 2.5% and `SassyGirl` by 2%.
- **`enemyWalkMinSpeed` (10 px/s)**, the speed below which an enemy counts as
  standing rather than walking. Standing still is a question of speed, not of
  movement being exactly zero: `_approach()` ramps down as it closes on its
  target, so an enemy settling onto a deadzone spends its last moments creeping
  a few pixels a second, which is real movement by the arithmetic and none at
  all to look at. It was enough to keep a walk cycle turning under a character
  that had to all appearances stopped, which is only visible now that standing
  still has artwork of its own. On a slider in the debug enemy panel.
  - This is the threshold only for choosing the pose. Whether the enemy is
    stepped at all is unchanged, so the creep still closes the last pixels.
  - For the slowest enemy in the roster the AI's own speeds are 116 px/s
    rushing, 37 flanking and 33 holding off a rush, all far above the line. It
    catches the tail of an approach and nothing else.

### Notes
- Six of the seven characters name their frames `<Enemy>_ideal_<n>.svg`;
  `JumpingJunkie` names its `_idle_<n>.svg`. The config takes the files as they
  are, so nothing is blocked, but the sets disagree with each other and with the
  `idle` state they feed. The spelling is not just the filename: it is the root
  `id` inside each SVG, so it comes from the layer names in the drawing
  document and would come back on the next export. Worth fixing there rather
  than here, alongside the open TODO to rename the asset layers.

---

## [2026.09.20]

### Added
- **HyJungScout is fully animated.** It had a walk built from its idle pose and
  a one frame attack, and no hit reaction or collapse at all. Its entry in
  `config/enemy-assets.json` now covers the frames that landed with it:
  - `walk` is a five frame loop, `walk_0` through `walk_4`. As with
    `TightRomper` the set is a full cycle rather than a half one: the boots span
    133, 133, 57, 97, 186 px, which is the rear leg lifting, tucking through the
    passing pose and swinging out to full stride, so it plays straight through
    and loops. The old entry ping-ponged three frames and used the idle pose as
    the first of them; `HyJungScout.svg` is now the idle and nothing else.
  - `attack` is a fourteen frame blade sequence, `attack_0` through
    `attack_13`: the draw, the lunge, and putting the weapon away again.
  - `damage` is a four frame hit reaction and `preDefeat` a four frame topple
    that carries on from it, with `defeat` assembling that topple and
    `defeat_0` / `defeat_1` into the settled pose on the floor.
  - Every one of those states is authored as a bare suffix, so each is the
    contiguous numbered run on disk and adding a frame to any of them needs no
    config edit. `TightRomper` spells its runs out frame by frame instead; both
    forms resolve identically.
- **Per-character attack pacing.** An enemy entry in `config/enemy-assets.json`
  may declare `attackTime`, the seconds its attack frames take to play. The
  shared timings in `config/enemies.json` can only suit one sequence length and
  they are tuned for the short ones: a fourteen frame weapon draw and a two
  frame jab cannot read at the same rate. `HyJungScout` is the first to use it,
  at 1.5s, which puts its swing at about 107ms a frame instead of 36ms.
  - The swing lasts that window plus `enemyAttackFrameHold`, the tail that
    leaves the final pose on screen. An enemy with no `attackTime` therefore
    lands back on exactly `enemyAttackDuration` and nothing about it moves.
  - `enemyAtkHitDelay` is one number for every character, so it only means
    anything as a position within the sequence. Stretching an enemy's frames
    stretches its hit delay by the same factor, which keeps the blow landing on
    the frame the artwork connects on rather than sliding back into the
    wind-up. HyJungScout's lands at 810ms, on `attack_7`, the full lunge. Every
    other character still lands at 270ms on the frame it did before.

### Changed
- **The debug enemy dropdown is sorted alphabetically.** It was built straight
  off `ENEMY_DEFS`, which is ordered by stage: the right order to read that
  table in and the wrong one to hunt a name in.
- `HyJungScout_attack.svg` and `HyJungScout_defeat.svg` were renamed to
  `_attack_0` and `_defeat_0` as the first frames of their runs. The config
  needed nothing for this beyond the entry above: a literal
  `<EnemyName>_<suffix>.svg` always wins over an inferred run, so removing the
  literal is what lets the numbered rule pick the run up.

### Notes
- `attackType` stays `bodyAttack` even though the character now visibly carries
  a blade. `weaponAttack` is not a description of the artwork, it is the config
  layer that grants `canGetUp`, one `getUp`, and a `getUp` animation. With no
  get-up frames on disk that state falls back to `preDefeat`, so the enemy would
  play its collapse forward again in place of standing up. Worth switching once
  get-up frames exist.

---

## [2026.09.19]

### Added
- **TightRomper is fully animated.** The character had artwork for a single
  standing pose and a lying defeat pose, so it walked, swung and died on that
  one frame. It now has an entry in `config/enemy-assets.json` wiring up the
  frames that landed with it:
  - `walk` is a five frame loop, `walk_0` through `walk_4`. The set is a full
    cycle rather than a half one: measured at the boots the stride goes
    94, 84, 131, 66, 139 px, which is passing and contact poses alternating for
    each leg in turn, so it plays straight through and loops rather than
    ping-ponging the way `BadGirl` and `SassyGirl` do.
  - `attack` is a nine frame high kick, `attack_0` through `attack_8`, covering
    the wind-up, the extension and the recovery back to standing.
  - `damage` is a seven frame hit reaction, `damage_0` through `damage_6`.
  - `preDefeat` is the five frame collapse from staggering to hands and knees,
    and `defeat` assembles that collapse with `defeat_0` through `defeat_2` to
    carry the body the rest of the way to the floor.
- **Crates take three blows to break, and show it.** A crate used to burst on
  the first thing that touched it, which made the only interactive scenery in
  the game a non-event. `BreakableObj` now counts hits against
  `CFG.objBreakHits` (3) and runs through three states: intact, the new
  `assets/Object_Box_Damaged.svg` once it has been hit at all, and the existing
  broken sprite when it gives way. Setting `objBreakHits` to 1 restores the old
  one-shot behaviour exactly.
  - The damaged sprite is the intact crate's own artwork with a split running
    the height of the front face, a chunk knocked out of the top rim, and a
    punched-through hole in the upper left slat. It shares the intact crate's
    viewBox, so the two swap without the crate appearing to move.
  - Every surviving blow rocks the crate away from the player: a decaying
    wobble over `objHitShakeTime` (0.18s) peaking at `objHitShakeDist` (4px).
  - Blows are tagged with a new `Player.atkSeq`, bumped once per swing in
    `_doAttack()`. The crate hit test runs on every frame of an attack
    animation, so without it a single punch would have spent the crate's whole
    health in the handful of frames its hitbox overlapped.
- **A crate that breaks throws splinters.** `BreakFX` (`js/entities/breakfx.js`)
  joins `HitFX` in the `effects` array and follows the same contract. It spawns
  `objBreakFxCount` (16) shards in an upward fan, integrates them under half
  gravity for `objBreakFxTime` (0.65s), and fades a dust puff out underneath
  them. The shards are drawn as rotating quads in colours sampled from the crate
  art rather than sprited, so no two breaks look alike. The break also upgrades
  its impact flash from `medium` to `hard`, which is what now separates the
  sound of a crate giving way from a blow that only damages it.
- **The title screen answers to the keyboard.** Up/down or W/S move the
  highlight between GAME, DEBUG MODE and DEBUG LEVEL, and Enter or Space starts
  the highlighted mode. Clicking a button still works, and hovering one moves
  the highlight so the mouse and the keyboard never disagree about which entry
  is live.
  - The highlight is tracked in `TITLE_ITEMS` / `titleIdx` rather than through
    DOM focus, because the browser activates a focused `<button>` on Enter as
    well and driving the menu through focus would start the chosen mode twice
    on one keypress.
  - The press that starts the game is consumed with `clearJustPressed()`, so
    Space on the title screen does not also reach the first frame of play and
    make the player jump on the way in.
- **Both debug panels resize horizontally.** Either panel can be dragged wider
  or narrower by its inner edge, between 180px and 45% of the window. The width
  is kept in `localStorage` per panel, so a panel opened at a comfortable size
  is still that size the next time debug mode is entered, and shrinking the
  window pulls an oversized panel back in rather than leaving it covering the
  playfield.
  - The handle is a child of the panel so it hides and shows with it, but it is
    positioned against the viewport: an absolutely positioned child would
    scroll away with the panel's contents. It is parked on the panel object
    itself and re-appended after `buildDebugPanel()` replaces the innerHTML,
    rather than being rebuilt with its listeners each time.
  - Slider rows now flex instead of holding a fixed 100px label column, so a
    widened panel gives the sliders the extra room and a narrowed one ellipsises
    the labels instead of squeezing the sliders to nothing.

### Fixed
- **An enemy standing on a movement threshold strobed between its walk and its
  idle pose.** `_approach()` snaps to exactly 0 inside its deadzone and the AI
  re-decides between walking and standing every frame, so an enemy parked on a
  deadzone, on `enemyCloseEnough`, or on the radius that counts it as a rusher
  answered differently on consecutive frames. Every flip went through
  `setState()`, which rewinds `animT`, so the walk cycle never got past its
  opening pose while the idle sprite flickered over it. The four AI branches
  now go through `Enemy._walkOrIdle()`, which holds the walk for
  `ENEMY_IDLE_SETTLE` (0.15s) past the last movement and carries `animT` across
  the swap. An enemy that has genuinely stopped still settles into idle.
  - The defect is as old as the AI. It was invisible until now because every
    enemy configured so far drew its idle and the first frame of its walk from
    the same file, so there was nothing to see flicker.
- **The damage run restarted on every blow, so a combo never got past the first
  hunch.** `takeDamage()` called `setState('hurt', ...)` per hit and that
  rewinds `animT`. A four hit combo used to show
  `damage_0, damage_1, damage_0, damage_1, ...` before finally running. A blow
  arriving mid-flinch now extends the timer through `Enemy._beginHurt()`
  instead of restarting the run, so one reaction plays across the whole combo
  and holds its final pose once the frames are spent: it ends on the last hit
  rather than snapping back to the start.

### Changed
- `TightRomper` is out of the `wipEnemies` list in `config/enemy-assets.json`,
  since it no longer needs the bare defaults an unconfigured enemy falls back
  to. All 25 characters still build with no unresolved sprites.
- **`enemyHurtTime` (0.55) replaces the `ENEMY_HURT_DURATION` constant** that
  was hardcoded at 0.35 in `js/entities/enemy.js` and read from four call
  sites. It is in `config/enemies.json` and on a slider in the debug enemy
  panel, the same treatment `playerHurtTime` got in `2026.09.15`. The longer
  window is what lets a multi-frame reaction such as TightRomper's seven frames
  actually read; note that it also governs how long a blow staggers an enemy,
  since the flinch is the stagger.
- **`enemyAttackDuration` is 0.95, up from 0.9.** The active part of a swing is
  `enemyAttackDuration` minus `enemyAttackFrameHold` (0.45), so this widens it
  from 0.45s to 0.50s: about 6ms more per frame on a nine frame attack. It also
  moves where `enemyAtkHitDelay` (270ms) lands in TightRomper's kick, from the
  recovery frame back onto the extension.
- **Five new object keys, in `config/objects.json` and on sliders in the debug
  object panel:** `objBreakHits`, `objHitShakeTime`, `objHitShakeDist`,
  `objBreakFxCount` and `objBreakFxTime`. `exportObjects()` writes all five.
- **`update()` in `game.js` now ticks `breakables`.** They had no per-frame
  state before; they do now, for the hit recoil.

---

## [2026.09.16]

### Fixed
- **The player no longer changes size as the animation changes shape.** The
  collapse and defeat poses drew the character at roughly twice the standing
  size, and the run cycle at about 1.17x, because `Player.draw()` sized each
  frame by `naturalWidth` / `naturalHeight`. The sprite files carry a viewBox
  but no width or height, so the browser has an aspect ratio but no intrinsic
  size and falls back to the default sizing algorithm: the largest box of that
  ratio fitting 300x150. Every upright pose is therefore pinned to 150px high
  whatever its real height, and a wide frame such as `Player_PreDefeat_7`
  (184x63) or `Player_Defeat` (184x45) stretches to the full 300px across, a
  1.63x blow-up that lasted exactly as long as the player was on the floor.
  Frames are now drawn at the idle frame's scale, so the standing size the game
  is tuned around is unchanged and everything else is in proportion to it.
  - This is the same defect that was fixed for enemies in `2026.09.09`; the
    player simply never went through that path.

### Added
- **Enemy-supplied player animations.** An enemy entry in
  `config/enemy-assets.json` may carry an `apply<State>` property naming a
  player animation its hits swap in for the player's own. The captured state is
  the one being replaced and the value qualifies it, so
  `"applyDamage": "Electrocuted"` resolves to `Player_Damage_Electrocuted_0.svg`
  onwards and plays over `CFG.playerHurtTime` in place of the stock damage
  reaction. `SassyGirl` is the first to use it.
  - A plain `Player_<State>_<Variant>.svg` is used when one exists; otherwise
    the numbered-range rule picks up the contiguous run from `_0`.
  - A variant with nothing on disk warns once and is dropped, so the player
    falls through to its own artwork rather than drawing blanks.
  - The animation is attached to the blow that carried it and replaced on every
    hit, so one enemy's effect never leaks into another enemy's punch.
  - The property sits at the enemy level and merges across the same defaults,
    attack-type and entry layers as everything else.
- **Unified sprite scaling** in `js/sprites/loader.js`, applied to every sprite
  in the game rather than to one character type. `loadSvgImg()` records the
  authored viewBox size on each sprite as it loads, and two helpers read it:
  - `svgUnitPx(refImg)` measures screen pixels per authored SVG unit from one
    reference frame, returning 0 while the reference is still undecoded so
    callers fall back to natural size and measure again later.
  - `svgDrawSize(img, unitPx)` gives a frame's on-screen size at that scale,
    falling back to natural size for a sprite with no authored dimensions, so a
    generated or unparsed SVG still draws.
  Any new asset now inherits correct scaling from the loader instead of
  depending on the shape of the box it happens to be drawn in.
- `_playerDrawSize()` in `js/entities/player.js`, which measures the player once
  against `PLAYER.idle1` and caches the result.

### Changed
- `_enemyUnitPx()` and `_enemyDrawSize()` delegate to the shared helpers, and
  `_loadEnemyFrame()` no longer parses viewBoxes itself, since every sprite is
  measured at load. The enemy-local `ENEMY_VIEWBOX_RE` is gone; behaviour is
  unchanged (all 179 enemy frames across 25 characters still measure the same).
- Player walk, run and transition frames now draw at their authored proportions
  rather than being stretched to a uniform 150px height: the walk is about 6%
  shorter than before and the run about 15% smaller, which is the difference
  between a standing figure and a crouched or leaning one. To move the whole
  character's on-screen size, change the reference frame in `_playerDrawSize()`.

---

## [2026.09.15]

### Added
- **Player damage animation.** `Player_Damage_0` through `Player_Damage_3` are
  wired into the `hurt` and `knockedUp` states and played once across
  `CFG.playerHurtTime`, replacing the single `Player_Damage.svg` pose those
  states held. The single pose stays loaded as the fallback for every player
  sequence, so nothing is ever drawn blank.
- **Player collapse and get-up.** `Player_PreDefeat_0` through
  `Player_PreDefeat_7` take the player from standing to flat on the floor. A
  knockdown plays them forward over `CFG.playerCollapseTime`, holds the flat
  pose, then runs the same frames backward over `CFG.playerGetUpTime` as the
  player pushes up, so getting up needs no artwork of its own. A knockdown
  shorter than the two together scales both to fit rather than letting the fall
  eat into the rise.
- **Player defeat outro.** `Player_Defeat.svg` is the settled pose the body
  holds once a life is lost. `_die()` no longer spends the life outright: it
  starts a `defeat` state that collapses over `CFG.playerDefeatTime` and holds
  the defeat pose for `CFG.playerDefeatHoldTime`, and `_finishDefeat()` then
  respawns the player or shows GAME OVER. `gameState` stays `playing` for the
  whole outro so it keeps being updated and drawn, and because the timer is
  advanced from `update()` a paused game holds the pose instead of resolving
  behind the pause screen.
- `Player.defeated`, true for the length of that outro. The player cannot be
  damaged, moved or controlled during it, and an enemy strike already in the air
  when the player goes down is dropped rather than landing on the body.
- `PLAYER_DAMAGE_FRAMES` and `PLAYER_COLLAPSE_FRAMES` in `js/sprites/player.js`,
  built once at load from the optional frames that are actually on disk. A frame
  that is missing drops out of its sequence there instead of being tested every
  time the animation is drawn.
- New tunables, all exposed as sliders in the debug player panel:
  `playerHurtTime` (0.35), `playerCollapseTime` (0.40), `playerGetUpTime`
  (0.45), `playerDefeatTime` (0.70) and `playerDefeatHoldTime` (1.20).

### Changed
- The hurt state duration is read from `CFG.playerHurtTime` instead of the 0.35
  that was hardcoded at both call sites, so the damage sequence and the state
  that shows it can no longer drift apart.
- The procedural knockdown tip in `Player.draw()` is now the last resort rather
  than the second: a dedicated `Player_KnockDown.svg` still wins, the collapse
  frames come next, and the rotation only runs when neither exists.
- The HP bar is refreshed as the player goes down. It previously kept its last
  reading through a death because `takeDamage()` returned before updating it.

---

## [2026.09.09]

### Added
- **Assembled animations** in `js/sprites/enemies.js`. A suffix inside a
  sequence may now name another animation state on the same enemy. When it
  does, and no literal `<EnemyName>_<suffix>.svg` is on disk, that single token
  is replaced in place by every frame the named state resolves to. A defeat
  sequence can therefore stay authored as
  `["damage_2", "preDefeat", "defeat"]` whether the enemy's `preDefeat` is one
  held pose or a multi-frame collapse.
  - A literal asset always wins, so enemies that still ship a real
    `<EnemyName>_preDefeat.svg` (`CrimeGuy`, `JammingJabber`, `JumpingJunkie`)
    resolve exactly as before.
  - Expansion is skipped for self references, for names already on the
    resolution path (cycles keep the literal name), and for `files` entries,
    which are authored sprite names rather than state suffixes.
- `_enemyAssetExists()` asset probe, a cached synchronous XHR that reports
  whether a sprite file is actually on disk. It treats a 2xx status as present
  and, on `file://` where the status is always 0, falls back to a non-empty
  response body. The cache holds the response body as well as the answer, so a
  probe and the sprite load that follows it share a single request.
- **Numbered range expansion.** A suffix with no literal file and no matching
  state expands to the contiguous run `<suffix>_0`, `<suffix>_1`, ... for as
  long as those files exist. The run must start at `_0` and is cut at the first
  gap, so a stray leftover frame never joins a shorter animation. Dropping
  `SassyGirl_defeat_0.svg` and `SassyGirl_defeat_1.svg` into `assets/` is enough
  to turn a one-frame defeat into a two-frame one.
- **Get-ups.** An enemy may declare `canGetUp` and a `getUps` count: how many
  times a lethal blow only knocks it down instead of finishing it. Each get-up
  restores `CFG.enemyGetUpHealthFactor` of max HP and replays the
  knockdown -> get-up chain, with the enemy invincible for the whole recovery so
  a player standing over it cannot chain-hit the revive into nothing.
- **`attackTypeDefaults` config layer** in `config/enemy-assets.json`, sitting
  between the global `defaults` and each enemy entry. Weapon-wielding enemies
  (`attackType: "weaponAttack"`) now default to `canGetUp: true`, `getUps: 1`
  and a `getUp` animation, so the behaviour arrives with the archetype instead
  of being restated per character.
- **`getUp` animation state**, drawn by the existing `getup` state in place of
  its old `preDefeat` stand-in. Characters with no get-up frames still fall back
  to `preDefeat`.
- **Conditional taunt follow-on.** An enemy that maps a `taunt` animation gloats
  for `CFG.enemyTauntTime` after standing up before rejoining the fight. One
  with no taunt goes straight back to idle, so nothing follows for the rest of
  the roster.
- **`powerAttack`**, a common animation property for the harder swing an enemy
  uses once it has stood back up. When it is not authored it is derived from the
  attack sequence by swapping the final frame for
  `<EnemyName>_attack_powerAttack`, which the numbered-range rule expands when
  `attack_powerAttack_0..n` exist. With no such asset the original final frame
  stays put, so the derived state is simply the normal attack. Derivation runs
  only for enemies that can get up.
- **Defeat outro.** A defeated enemy now leaves in three phases instead of
  vanishing on a timer: its defeat animation plays, then its final frame (a
  single defeat asset or the last frame of a sequence, either way) is held on
  screen and blinked for `CFG.defeatBlinkTime`, then the body fades out over
  `CFG.defeatFadeTime`. The shadow fades with the sprite but does not blink with
  it, since a blinking shadow reads as a rendering fault rather than a body
  winking out.
- **Player reactions to power attacks.** A landing blow can now do more than
  damage. An enemy opts in with a `powerAttackEffect` entry in its animations
  map, and an enemy that is genuinely swinging its power attack gets the default
  reaction without declaring anything.
  - `playerFreeze` (the default) disables movement and key presses for
    `CFG.powerAttackFreezeTime` while the player blinks. Buffered presses are
    discarded rather than queued, so nothing fires in a burst when it lifts.
  - `playerKnockDown` puts the player on the floor for `CFG.playerKnockdownTime`.
    With no `Player_KnockDown.svg` or `Player_PreDefeat.svg` on disk the damage
    pose is tipped over about the player's feet, easing down and back up; drop
    either asset in and it is used instead.
  - `playerKnockBack` pushes the player `CFG.powerAttackKnockBackDist` px along
    the blow, using the existing `Player_Damage.svg` pose.
  - `playerTakesAdditionalDamage` multiplies the hit by
    `1 + CFG.powerAttackDamageBonus`.
  - `"mode"` takes one name or a list. The `"mode": "array"` sentinel with the
    names in a sibling `"array"` property is accepted as written, and a plain
    array in `"mode"` works too. Spellings are matched case-insensitively with
    aliases, so `playerKnockedBack` and `playerKnockBack` are one mode and a
    typo warns rather than silently doing nothing.
  - A value sitting beside `powerAttackEffect` under the name of a mode tunes
    that mode for that enemy alone. `KingBruteBreaker` uses this to take
    `playerTakesAdditionalDamage: 0.5`, so the player takes half again on top of
    the hit rather than the default quarter.
  - The reaction applies to any enemy that declares it, including ones with no
    power attack, no weapon attack and no get-up assets. `KingBruteBreaker` is
    all three.
- **Measured power attack reach.** An enemy swinging a power attack now closes
  to, and strikes from, the width of its widest power attack frame instead of
  ordinary punching range. `SassyGirl` reaches 138px rather than the tuned 95,
  which is what her extended weapon frame actually covers. The reach is captured
  onto the swing alongside its facing, so the hit is judged by the attack that
  was thrown. The tuned baseline is a floor, so no enemy ever reaches less than
  it did.
- `loadOptionalSvgFile()`, which returns null for a sprite that is not on disk
  rather than a blank image, so a caller can pick a procedural fallback.
- `CFG.powerAttackFreezeTime`, `CFG.powerAttackKnockBackDist` and
  `CFG.powerAttackDamageBonus`, exposed as a `POWER ATTACK` section in the debug
  panel.
- `CFG.enemyPreDefeatTime`, `CFG.enemyGetUpDownTime`,
  `CFG.enemyGetUpHealthFactor` and `CFG.enemyTauntTime`, all exposed as live
  sliders under a new `ENEMY` section in the debug panel.
- `CFG.defeatBlinkTime`, `CFG.defeatBlinkFPS`, `CFG.defeatBlinkAlpha` and
  `CFG.defeatFadeTime`, exposed alongside `CFG.defeatFadeDelay` as a `DEFEAT`
  section in the debug panel.
- `Enemy.defeatLifetime`, the sum of the three outro phases. `isDone` reports
  against it, so the length of a body's stay is stated in one place.

### Changed
- Reworked the `SassyGirl` enemy sprite set. The walk cycle grew from a 4 frame
  loop to an 8 frame ping-pong (`walk_1` through `walk_4` and back), giving the
  character a full stride instead of a two pose shuffle.
- Expanded the `preDefeat` state from a single held pose to a 6 frame
  collapse sequence (`preDefeat_0` through `preDefeat_5`).
- Redrew the base, attack, pre-attack, damage, defeat and walk SVGs.
- Suffix resolution order is now explicit: literal asset, then assembled
  animation, then numbered range, then nothing. An authored file always wins
  over anything inferred.
- A suffix that resolves to nothing is dropped rather than loaded as a blank
  frame, so the state falls through to its `fallbackState` instead of holding an
  empty sprite. Dropped names are reported once each through `console.warn`.
- `CFG.defeatFadeDelay` retuned from 1.8s to 0.6s. It now covers only the defeat
  animation rather than a body's whole time on screen, and 0.6s keeps the total
  at the 1.8s it has always been. Wave clearing waits on `isDone`, so leaving it
  at 1.8s would have stretched every wave transition by two thirds.
- `Player.takeDamage()` takes an optional effect argument. Reactions are applied
  after the ordinary hit response so they can override the state and position it
  just set, and knockdown outranks knockback when both are listed.
- Effect entries share the animations map with real animations but are
  recognised by name, kept out of frame loading, and merged across the same
  defaults / attack-type / entry layers as everything else.
- `Entity.drawShadow()` takes an optional alpha scale so a caller can fade a
  shadow with its sprite. Existing callers pass nothing and are unaffected.
- Enemy frames are drawn from their authored viewBox units rather than from
  `naturalWidth`. `_enemyUnitPx()` resolves one pixels-per-unit factor per
  character from its reference frame, and `_enemyDrawSize()` applies it to every
  frame of every mapped animation. Standing poses keep the exact on-screen size
  they had, so existing tuning is untouched.
- `_enemyDefeatScale()` is gone. It normalised a defeat frame's long side to the
  reference frame's long side, which was a partial correction applied only to
  the `dead` state; with every frame now scaled from its authored size there is
  nothing left for it to correct. `CFG.defeatScaleX`, `defeatScaleY`,
  `defeatRotation` and the offsets still tune the death pose.
- `SassyGirl` is the first character carrying every new mapping: `getUp`,
  `taunt`, `powerAttack`, an assembled `preAttack`, and a `defeat` that runs
  `damage_2`, the six-frame `preDefeat` collapse, then `defeat_0` and
  `defeat_1`.

### Removed
- Dropped the unused `SassyGirl_punch_1.svg` and `SassyGirl_punch_2.svg`
  sprites. `SassyGirl` uses `weaponAttack`, so the punch frames were never
  referenced by `config/enemy-assets.json` (roughly 1,150 lines of dead SVG).
- Replaced `SassyGirl_preDefeat.svg` with the numbered `preDefeat_0..5` set.

### Fixed
- `SassyGirl.defeat` no longer resolves a missing `SassyGirl_preDefeat.svg`.
  Removing that file left the `preDefeat` token in the defeat sequence pointing
  at nothing; assembled animations now expand it to the full
  `preDefeat_0..5` collapse. With `SassyGirl_defeat.svg` since replaced by
  `defeat_0` and `defeat_1`, the numbered-range rule picks those up too, so
  defeat now plays as 9 frames.
- `SassyGirl.powerAttack` listed suffixes `powerAttack_0..2`, which resolved to
  files that do not exist. Corrected to `attack_powerAttack_0..2`, matching both
  the assets on disk and the documented
  `<assetIdentifier>_attack_powerAttack.svg` convention.
- `BadGirl.defeat` used `"files": ["defeat"]`. Since `files` entries are
  complete sprite names, that resolved to `assets/defeat.svg` rather than
  `assets/BadGirl_defeat.svg`. Changed to `"suffixes": ["defeat"]`.
- A knockdown sat on the first `preDefeat` frame for its whole duration and then
  cut straight to the downed get-up pose. `SassyGirl.preDefeat` was declared
  `"mode": "hold"`, which draws frame one and nothing else, and the knockdown
  drew it with no duration to advance against. Her six-frame collapse is now a
  `sequence` and the knockdown plays it over `CFG.enemyPreDefeatTime` before
  holding the final pose, which removes both the dead pause and the jump from a
  38px-wide standing pose to a 100px-wide lying one.
- A multi-frame animation authored as `"mode": "hold"` froze on its first frame
  for the whole state. `BadGirl`'s defeat sequence therefore showed only her
  damage pose and never the collapse or the defeat frame behind it. A hold given
  a duration now plays through and holds its final frame, which is what
  authoring a collapse as a hold is meant to express; single-frame holds, the
  states the mode was made for, are untouched.
- A `"mode": "loop"` animation given a duration but no frame rate had the same
  problem, because no caller passes an attack an fps. `SassyGirl`'s power attack
  sat on its opening frame and never reached the extended swing. A loop given
  only a duration now plays through once across it, while a loop with an
  explicit rate, such as a walk cycle, is unchanged.
- A character with collapse frames whose `defeat` never named `preDefeat` cut
  straight from standing to its final downed pose. The collapse is now woven
  into the front of such a defeat automatically. Characters whose defeat already
  covers the collapse, and those with no collapse, are untouched.
- Enemies grew as they fell over. Sprite SVGs declare a viewBox but no width or
  height, so the browser has an aspect ratio but no intrinsic size and falls
  back to the CSS default sizing algorithm: the largest box of that ratio that
  fits 300x150. A tall standing pose is pinned to 150px high while the same
  character lying down stretches to 300px across, so `naturalWidth` measured a
  frame's shape rather than the artwork. `SassyGirl`'s collapse was drawn at
  1.14x, 1.22x, 1.25x, 1.50x, 2.09x and finally 2.45x her authored scale, which
  read as her swelling into a giant and then shrinking back as she stood up.
  Rasterising the whole roster confirmed the art itself is authored at one
  consistent scale (ink coverage stays within 0.72 to 1.00 of each character's
  base frame), so the drawing code was the only thing at fault. Frames are now
  scaled from their authored units and the collapse holds one size throughout.
- A get-up knockdown reused `CFG.enemyKnockdownTime` (1.5s), long enough to read
  as a stall. Revives now use their own `CFG.enemyGetUpDownTime` (0.85s), so a
  normal knockdown is unchanged.
- Defeat frames were rendered from the same distorted `naturalWidth`, partly
  masked by a long-side normalisation that happened to land near the right size
  for some characters and not others. They now use the same authored scale as
  every other state. `SassyGirl`'s `defeat_0` goes from 150x49 to 113x37 and
  `JumpingJunkie`'s sprawled defeat gets longer rather than being squashed to
  the reference length.

---

## [2026.09.06]

### Added
- `BadGirl` gained a `damage` animation (`damage_0`, `damage_1`, `damage_0`,
  `damage_2`), so the character now reacts to hits instead of holding her walk
  pose.
- `BadGirl` gained a `preDefeat` sequence (`preDefeat_0`, `preDefeat_1`) ahead
  of the defeat frame.

### Changed
- Widened the `BadGirl` attack from a single `kick` frame to a 5 frame windup
  and recovery arc (`kick_0`, `kick_1`, `kick_2`, `kick_1`, `kick_0`).
- Redrew the base and walk SVGs.

### Fixed
- Corrected the misspelled `BadGilr_defeat.svg` asset to `BadGirl_defeat.svg`.

---

## [2026.08.10]

### Added
- **Local weather render layer** (`js/rendering/weather.js`). A purely additive
  layer that never touches the authored stage art, so the entire effect switches
  off with `CFG.weather`. It runs as two passes bracketing the entity depth sort
  in `draw()`:
  - `drawWeatherSky(stageData)` for the moon, drifting storm clouds and sky tone,
    drawn behind characters.
  - `drawWeatherFront()` for rain, splashes, lightning and heat haze, drawn in
    front of everything the depth sort just painted but under the HUD.
- Weather sprites at `assets/weather/` (`cloud.svg`, `moon.svg`, `rain.svg`),
  loaded through `js/sprites/weather.js` so they pass through the same
  `loadSvgFile` Blob URL wrapper and `ASSETS_READY` decode gate as every other
  sprite module.
- Weather configuration block in `js/core/config.js`: `weather`, `weatherNight`,
  `weatherTone`, `weatherPrecip`, `weatherClouds`, `weatherCloudCount`,
  `weatherRainCount`, `weatherRainSpeed`, `weatherWind`, `weatherLightning`,
  `weatherToneAlpha` and `weatherSkyLift`.
- Debug panel `WEATHER` section with a `Local Weather` toggle and live sliders
  for rain count, rain speed, wind, clouds per layer, tone grade and daylight
  lift.
- `local-weather-style/STYLE.md`, documenting the mapping from weather server
  directives to the `CFG` keys the render layer reads.

### Changed
- Both weather passes are driven by `performance.now()` rather than the frame
  delta, matching `drawBgAmbience()`. Weather keeps moving on the pause screen
  and never mutates game state.
- Rain particles are positioned from their index via a deterministic pseudo
  random helper rather than stored state, so the field survives a pause, a stage
  change or a live count change with no bookkeeping.
- Cloud and moon sprites are flattened once into offscreen canvases on first use
  instead of being recoloured every frame. Storm clouds are produced by tinting
  the white cloud art with `source-in`, avoiding a second asset.
- The moon rides the background tile at the same `0.45` parallax as `drawBg`, so
  on stages 1 and 2 it lands on the disc already painted into the scene SVG.
  Custom SVG scene stages have no tile grid and fall back to a fixed slot.
- `style.css` reworked for the weather layer and surrounding UI.

---

## Status of Current Repo

*As of `[2026.09.09]`, branch `main`, on top of commit `badd372`.*

### What runs today

A playable 2.5D side-scrolling beat-em-up in vanilla HTML5 Canvas. No build
step, no bundler, no dependencies. Open `index.html`, or play the deployed build
at <https://isocialpractice.github.io/street-crime/>.

- **3 stages**: THE STREETS, THE DOCKS, THE HIDEOUT, with `maskedmayhem` and
  `kingbrute` boss encounters.
- **7 configured enemies**: `BadGirl`, `CrimeGuy`, `HyJungScout`,
  `JammingJabber`, `JumpingJunkie`, `KingBruteBreaker`, `SassyGirl`.
- **157 SVG assets** in `assets/`, wired declaratively through
  `config/enemy-assets.json`.
- **Get-ups, taunts and power attacks** on weapon-wielding enemies. `SassyGirl`
  is the reference implementation: she stands back up once, taunts, then swings
  a heavier attack for the rest of the fight.
- **Debug mode** with live tuning sliders, sandbox spawning and config export,
  plus a `DEBUG LEVEL` mode that loads `levels/Test_ItWorked.svg` and walks its
  ordered `section_*` panels using the `#field` shape for walkable bounds.

### Architecture

Roughly 3,800 lines across 25 classic scripts under `js/`, loaded in explicit
dependency order from `index.html` (sprites, core, entities, level, ui,
rendering), with `game.js` as the entry point holding top-level state, the game
loop and boot. Tuning lives in `config/`: `configuration.json`,
`enemies.json`, `enemy-assets.json` and `objects.json`.

```
js/core/        canvas, config, input, camera
js/entities/    entity, hitfx, pickup, breakable, player, enemy
js/level/       data (STAGES table), manager, svg-scenes
js/rendering/   background, weather, draw
js/sprites/     loader, player, enemies, objects, backgrounds, weather, ready
js/ui/          hud, debug
```

### Known issues

- `assets.js` (roughly 38 KB) is no longer referenced by `index.html`. It is a
  leftover from before the `js/` module split and is dead weight in the repo.
- `README.md` still describes `assets.js` and `game.js` as the whole engine,
  which predates the `js/` split.

### Next up

See [TODO.md](TODO.md) for the full backlog. Nearest items on the `Current`
list: core collision detection, key actions, interactable background elements,
weapons, and using side-scrolling image art for level backgrounds.

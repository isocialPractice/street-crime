# Changelog

All notable changes to Street Crime are documented in this file.

Versions use a dated format, `[YYYY.MM.DD]`, matching the date the work landed on
`main` (for example `[2026.09.08]`). History below starts at `2026.08.10`; for
anything earlier, see the commit log.

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

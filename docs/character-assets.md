# Character Assets

Characters are drawn in Adobe Illustrator and exported as one SVG per pose or
frame. The file name says which character and which action it is; the names of
the layers inside it say which part of the body each shape belongs to.

Also as a [quickstart](character-assets_quickstart.md) and a [cheatsheet](character-assets_cheatsheet.md).

## Folders

```text
assets/characters/player/      the player
assets/characters/enemy/       every enemy, one flat folder
assets/characters/friendly/    planned: friendly characters (empty for now)
assets/characters/neutral/     planned: bystanders (empty for now)
support/                       Illustrator source files (.ai), not committed
```

Keep the `.ai` sources in `support/`. That folder is git-ignored because detailed
art files grow quickly; `support/source-player.ai` and `support/source-enemies.ai`
are committed as examples. See `scripts/README.md`.

## File names

| File | Is |
| --- | --- |
| `<Name>.svg` | the default pose |
| `<Name>_<action>.svg` | a single pose for an action |
| `<Name>_<action>_<n>.svg` | frame `n` of an action |

`<Name>` is the character's asset name: `CrimeGuy`, `BadGirl`, `KingBruteBreaker`.
The site that serves the game is case-sensitive, so a file name has to match the
name in the config letter for letter.

## Enemies: `config/enemy-assets.json`

Enemy frames are wired in by configuration, not code. The file has four parts:

| Part | Is |
| --- | --- |
| `defaults` | the animations every enemy has, and how each plays |
| `enemies` | each character's own animations, keyed by asset name, laid over the defaults |
| `attackTypeDefaults` | extras for an attack type, such as `weaponAttack`'s get-up |
| `wipEnemies` | characters whose art is still in progress: loaded with the defaults only |

An animation is a mode and a list of suffixes:

```json
"BadGirl": {
  "attackType": "bodyAttack",
  "animations": {
    "walk":   { "mode": "loop",     "suffixes": ["", "walk_1", "walk_2", "walk_1"] },
    "attack": { "mode": "sequence", "suffixes": ["kick_0", "kick_1", "kick_2", "kick_1", "kick_0"] }
  }
}
```

Each suffix names a file: `""` is `BadGirl.svg`, `"walk_1"` is `BadGirl_walk_1.svg`.

### The animations

| Animation | Default mode | Falls back to | Plays |
| --- | --- | --- | --- |
| `idle` | `hold` | | standing |
| `walk` | `loop` | | moving |
| `attack` | `sequence` | `idle` | a strike |
| `powerAttack` | `sequence` | `attack` | a stronger strike |
| `damage` | `sequence` | `idle` | taking a hit |
| `preDefeat` | `hold` | `damage` | the blow that finishes it |
| `defeat` | `hold` | `idle` | down for good (default file `<Name>_defeat.svg`) |
| `taunt` | `sequence` | | after getting back up |
| `block` | `sequence` | `idle` | optional guard (`block`, `block_hold`) |
| `blockResist` | `hold` | | optional, the guard shuddering (`block_resist`) |
| `getUp` | `sequence` | `preDefeat` | `weaponAttack` enemies only |

An animation with no art falls back down that column, so a new character needs
very little to start.

### Modes

| Mode | Plays |
| --- | --- |
| `hold` | one pose; given a duration, plays through and holds the last |
| `loop` | cycles |
| `sequence` | plays once and holds the last frame |
| `yoyo` | out and back without repeating either end: five frames are 0 1 2 3 4 3 2 1 |

An unknown mode is treated as `hold`.

### How a suffix finds its files

First found wins:

1. **The literal file** `<Name>_<suffix>.svg`.
2. **Another animation**: a suffix that names one of the same character's
   animations is replaced by all of its frames. That is how
   `"defeat": ["damage_2", "preDefeat", "defeat"]` works whether `preDefeat` is one
   pose or several frames.
3. **A numbered run**: `<Name>_<suffix>_0.svg`, `_1`, ... for as long as they exist
   (up to 64). Dropping `SassyGirl_defeat_0.svg` and `_1.svg` into the folder turns
   a one-frame defeat into two frames with no config change.

Other per-character settings (`attackTime`, `files`, `canGetUp`, `getUps`,
`anchorWeapon`, `apply<State>`) are described where they are read, at the top of
`js/sprites/enemies.js`.

### Adding a new enemy

1. Export its art as `<Name>.svg`, `<Name>_walk_0.svg`, ... into `assets/characters/enemy/`.
2. Add `"<Name>": { "animations": { ... } }` under `enemies` in
   `config/enemy-assets.json` (or list it in `wipEnemies` to start with the defaults).
3. Give it stats: an entry in `ENEMY_DEFS` in `js/entities/enemy.js`, whose `img` is
   `<Name>`. This is the one step that is code today.
4. Put it in a fight: a stage wave in `js/level/data.js`, or a level design's
   spawn group `"pool"` ([level-design.md](level-design.md#spawn-groups)). Enemies
   without `boss` or `mini` join the default pool on their own.

## The player

The player's frames are listed by name in `js/sprites/player.js`, so new player
frames need a line there. What exists today:

| Action | Files |
| --- | --- |
| idle | `Player_Ideal_1.svg` to `_4` |
| walk | `Player_Walk_0.svg` to `_7` |
| walk to run | `Player_Transition_0.svg` to `_2` |
| run | `Player_Run_0.svg` to `_7`, with `Player_Run.svg` as the fallback |
| attacks | `Player_Punch_1`, `_2`, `Player_Kick_1`, `_2`, `Player_UpperCut`, `Player_JumpKick`, `Player_RunningKick` |
| guard | `Player_Block_0`, `_1`, `Player_Block_hold`, `Player_Block_resist` |
| hurt and down | `Player_Damage` and its numbered frames, `Player_PreDefeat` and `_0` to `_7`, `Player_Defeat` |

**Reactions an enemy applies.** An enemy's config can carry, for example,
`"applyDamage": "Electrocuted"`, and a blow from it then plays
`Player_Damage_Electrocuted.svg`, or the numbered run from
`Player_Damage_Electrocuted_0.svg`. These are found by name, with no code change.

## Layer names inside a character

Illustrator writes every layer, group and path name as the `id` of its SVG
element. Named parts are what let the game recolor a vest (see
[Recoloring parts](#recoloring-parts)) and, later, swap a jacket:

| Level | Names | Example |
| --- | --- | --- |
| frame group | the artboard's action and frame | `walk_0` |
| part | the body part | `front-glove`, `back-shoe`, `Head`, `hair`, `left-vest` |
| tone | `<part>-highlight`, `-light`, `-mid`, `-dark`, `-shadow`, and `outline` (or a `strokes` group) | `vest-light`, `vest-mid`, `vest-dark`, `vest-shadow` in `JumpingJunkie.svg`; `arm-light`, `arm-mid`, `arm-dark` in `Player_Block_0.svg` |
| outfit piece | one group per swappable piece | `jacket-a`, `hat` |

Unnamed items export with no id. A name used twice in one file gets a number on
export (`strokes`, `strokes-12`), so the game reads a part by its place under its
parent and its base name.

`scripts/mapLayers.jsx` renames layers in bulk from a JSON layer map, and
`scripts/mapSelectLayers.jsx` selects what a map points at so it can be checked in
Illustrator first. See `scripts/README.md`.

The part and tone names above are the ones recoloring reads. The rest of the
scheme is **planned** (it is being agreed): outfit pieces, elite enemies with
their own stats, and player outfit and color select.

## Recoloring parts

A level design can spawn an enemy with some parts of its art in other colors,
without new art: JumpingJunkie with his gold vest in gray. The design names the
parts and a palette for each ([level-design.md](level-design.md#pool-entries)):

```json
{ "enemy": "JumpingJunkie", "render": { "left-vest": "gray", "right-vest": "gray" } }
```

Palettes are in `config/palettes.json` (described by
`config/schema/palettes.schema.json`): the tone names, lightest first, and a color
for each tone in each palette.

```json
{
  "tones": ["highlight", "light", "mid", "dark", "shadow"],
  "palettes": {
    "gray": { "highlight": "#e3e3e3", "light": "#c7c7c7", "mid": "#848484", "dark": "#545454", "shadow": "#050505" },
    "dark-gray": { "highlight": "#8a8a8a", "light": "#6a6a6a", "mid": "#4e4e4e", "dark": "#383838", "shadow": "#050505" }
  }
}
```

The gray ramp matches how light the gold it replaces looks, so the vest keeps its
contrast with the shirt and the outline. The dark gray ramp is darker than the
colors it replaces, with its tones further apart than theirs: SassyGirl's pink
dress shades by hue as much as by lightness, and gray has only lightness to shade
with. A palette missing a tone uses the nearest tone it has.

A pool entry can bring several of an enemy and recolor only some of them:
`{ "enemy": "SassyGirl", "count": 2, "re-render": 1, "render": { "dress": "dark-gray" } }`
is one SassyGirl in dark gray and one as drawn ([level-design.md](level-design.md#pool-entries)).

Every frame of the enemy is recolored as it loads; the files are never changed.
In each frame:

| Step | Rule |
| --- | --- |
| part | every layer named the part, or a numbered copy of it (`left-vest-2`) |
| side fallback | a frame with no `left-vest` but with a `vest` uses `vest`: `left-`, `right-`, `front-` and `back-` are dropped. JumpingJunkie's defeat pose draws its vest as one group, and turns gray this way |
| shapes | every path, rect, polygon, polyline, circle and ellipse in the part, except inside an `outline` or `strokes` group, and except shapes with no fill |
| tone | the nearest layer at or above the shape, inside the part, named `<tone>` or `<anything>-<tone>`, by its name before Illustrator numbered it (`vest-mid-4` is `mid`) |
| no tone name | the tone whose color is nearest the shape's own in lightness |
| color | set on the shape itself, which wins over the `.cls-N` rule it was filled by. Those rules are shared between parts, so they are never edited |

So name the tones of a part you want recolored, and keep its outline in a
`strokes` or `outline` group. A frame without the part warns once in the console
("`<Name>_<action>.svg` has no left-vest, so it stays as drawn") and is drawn as
it is. The level design's checks look for each part in the enemy's base frame,
`<Name>.svg`, and suggest the nearest layer name.

**Check it:** SANDBOX TEST, step `design-7-render`: a gold JumpingJunkie, then a
gray-vested one, walk out of the warehouse door.

## Names that do not follow the pattern yet

Older sets break the `<Name>_<action>_<n>` pattern in three ways. The config lists
the real file names, so they work; new art should follow the pattern.

| Today | Pattern |
| --- | --- |
| `Ideal` for idle: `Player_Ideal_1`, `BadGirl_ideal_0` | `idle` |
| action case varies: `Player_Walk`, `Player_PreDefeat` against `BadOne_walk`, `BadGirl_preDefeat` | one case, decided in the template work |
| frames from `_1` in some sets (`BadGirl_walk_1`, `Player_Ideal_1`) and `_0` in others | from `_0` |

A manifest that reads `assets/` and wires characters in from their file names
alone is **planned** for the template version of this repo.

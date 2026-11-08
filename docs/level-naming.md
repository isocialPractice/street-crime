# Level Layer Naming

A level is drawn in Adobe Illustrator and exported as one SVG. Illustrator writes
each layer's name out as the `id` of the matching SVG element, and the game reads
those ids. So the way a layer is named decides what it does: a walkable street, a
door into a building, a sign that animates, a gate that breaks.

This page covers everything a level SVG can say through its layer names. What
happens *when* (the gate breaks, then enemies come out of a door) is written in a
separate file, described in [level-design.md](level-design.md).

Also as a [quickstart](level-naming_quickstart.md) and a [cheatsheet](level-naming_cheatsheet.md).

## Files and folders

```text
assets/levels/<level>/
  level-<level>.svg          the level
  objects/                   frames and state art for its ANIMATE and BREAKABLE layers
  enterables/                interiors for its ENTERABLE and RESTRICTED layers
config/levels/<level>/
  level-design.json          when things happen (see level-design.md)
```

`theStreets` is the worked example throughout: `assets/levels/theStreets/level-theStreets.svg`.

## Exporting from Illustrator

Use **File > Export > Export As...**, choose SVG, and in the SVG options set
**Object IDs** to **Layer Names**. Without it the ids are generated and nothing
on this page works. The styling setting can stay on **Internal CSS**: the game
reads the `.cls-N` classes Illustrator writes into the file's `<style>` block.

Two things Illustrator does to names:

- **A space may come out as an underscore.** Every prefix below accepts `-` or `_`
  after it, so `ENTER building` exported as `ENTER_building` still works.
- **A duplicated name is numbered.** Two layers called `ENTER-building` export as
  `ENTER-building` and `ENTER-building-2` (the original name is kept in
  `data-name`). A numbered copy keeps its type, and a copied `ANIMATE-` layer shares
  the original's frames.

## Ids the scene is built from

| id | What it does |
| --- | --- |
| `field` | The walkable area: a rect, polygon or polyline. Movement, enemy spawns and object placement all stay inside it |
| `section_<n>` | A group that is one screen of the level, used in order from `section_1` |
| `border` | A rect inside a `section_<n>` group that sets that screen's slice. Without one, the slice comes from the section's own artwork |

A level with no `section_*` groups takes its screens from its `border` rects
instead, ordered left to right.

## Map ids

These ids give a level its behavior. Prefixes are **upper case and matched
exactly as written**, so ordinary art names such as `enter-sign` or
`object-shadow` never turn into behavior. The prefix is followed by `-` or `_`.

| id | Goes inside | What it does | In `theStreets` |
| --- | --- | --- | --- |
| `ENTERABLE-<name>` | anything | Something that can be entered. Its interior is `enterables/<name>.svg` (or the camelCase name) | `ENTERABLE-bad-bar` opens `enterables/badBar.svg` |
| `RESTRICTED-<name>` | anything | An `ENTERABLE` that starts locked. Same interior lookup | `RESTRICTED-import-export-warehouse` |
| `REQUIRE-case-<case>`, `REQUIRE-state-<state>` | `RESTRICTED` | What unlocks it. Can be an empty layer | (the warehouse uses the level design instead) |
| `REQUIRE-item-<item>` | `RESTRICTED` | **Planned.** Unlock by an inventory item | |
| `ENTER-<type>` | `ENTERABLE` or `RESTRICTED` | The way in. `building` swaps to the interior, `exit` goes back out, `vehicle` is **planned** | `ENTER-building` |
| `OBJECT-<name>` | anything | An area with something to interact with. On its own, pressing E in it reports `interact:<name>` | `OBJECT-sign-bad-bar`, `OBJECT-parking-gate-box` |
| `ANIMATE-<asset-name>` | `OBJECT` | Drawn from frames `<asset-name>_0.svg`, `_1`, ... placed where the layer was | `ANIMATE-sign-badBar` plays `objects/sign-badBar_0..2.svg` |
| `BREAKABLE-<name>` | `OBJECT` | Cut out of the scenery: blocks movement, takes hits and breaks like a crate | `BREAKABLE-parking-gate-arm` |
| `EVENT-<name>` | anything | A trigger area. The player walking into it reports `event:<name>` | |
| `negative-space` | inside `field` | A hole in the field that neither the player nor enemies can walk into | the parked red car |
| `INVENTORY-`, `MISSING-`, `SWITCH-`, `USABLE-` | `OBJECT` | **Planned.** Recognised and listed, with a "not built yet" warning | |

An id that looks like a map id but matches no rule, such as `ANIMTE-sign`, is
reported as a likely typo.

### ENTERABLE: buildings and other interiors

```text
ENTERABLE-corner-shop          the building
  ENTER-building               its door
  shop-front, shop-sign, ...   ordinary art
```

**Using a door.** The prompt `E: ENTER` shows over the player when they stand at
it. Pressing E goes through at once; pushing into the door (holding Up) does too,
after `CFG.enterHoldTime` (0.25 s). The player is in reach when the middle of their
body is over the door and their feet are within `CFG.enterDepthTol` (16 px) of its
depth.

**A door above the walkable area.** A door is drawn on a building's face and often
stops at the sidewalk while `#field` is the street below it, sometimes with a parked
car's `negative-space` in between. The door's reach runs down to the first ground
that can be stood on below it (inside the field, outside holes, at least 12 px
deep, within 200 px), so it can still be used. Coming back out, and anything that
comes out of the door, lands there too. Drawing a notch of `#field` up to the door
works as well: in `theStreets` the bar has one, the warehouse does not.

**Going in** fades to black over `CFG.enterFadeTime` (0.35 s), swaps the scene for
the interior, and fades back in. The scene left behind is kept, with its enemies,
breakables and pickups, and leaving the interior puts all of it back, with the
player just below the door they went in by. Arriving at a door never uses it
straight away: the player has to step out of its reach once first.

**Where the interior comes from**, first found wins:

1. the sandbox test's `"enterables"` entry for the name, a path inside the level folder
2. `enterables/<name>.svg`
3. `enterables/<camelCaseName>.svg` (`corner-shop` becomes `cornerShop.svg`)

An interior is laid out like the level it opens from: the same screen width and
height, and the same `objects/` folder for its own animated pieces. An interior
with no `ENTER-exit` of its own is left by walking into its left edge (a 96 px
strip, holding Left, or E).

An interior saved as a folder (for one with rooms of its own) is **planned**.

### RESTRICTED: locked doors

```text
RESTRICTED-storage-room
  REQUIRE-case-alarm-off       empty layer: unlocks when case "alarm-off" is true
  ENTER-building
```

A door inside a `RESTRICTED` layer is locked. Using it shows `E: LOCKED` and
reports `locked:<name>` on every try. It unlocks when its requirement holds:

| Requirement | Holds when |
| --- | --- |
| `REQUIRE-case-<case>` | that level design case is true |
| `REQUIRE-state-<state>` | that level design state has been entered |
| `REQUIRE-item-<item>` | **Planned**, needs an inventory |
| `"restricted": { "<name>": { "until": ... } }` in the level design | that trigger has held. This takes the place of any `REQUIRE-` layer |

Several `REQUIRE-` layers must all hold. A `RESTRICTED` layer with no requirement
anywhere stays locked, and the level map warns about it. Once unlocked it reports
`unlock:<name>` and stays unlocked for the rest of the run, in every scene.

### OBJECT: interaction areas

An `OBJECT-<name>` layer's box is an area. What sits inside it gives it behavior:
an `ANIMATE-` or `BREAKABLE-` layer. An `OBJECT` with neither is an interaction
spot: standing in it shows `E: INTERACT`, and pressing E reports
`interact:<name>`. A level design can wait on that event.

### ANIMATE: frame animation

```text
OBJECT-neon-sign
  ANIMATE-neon-sign            frames: objects/neon-sign_0.svg, _1.svg, _2.svg
```

**Where the frames come from**, first found wins:

1. a numbered run in the level's own folder: `objects/<asset-name>_0.svg`, `_1`, ...
2. the same run in the shared `assets/objects/`
3. a single `objects/<asset-name>.svg`, then `assets/objects/<asset-name>.svg`

A run starts at `_0` and stops at the first missing number, up to 64 frames, so a
stray `_7.svg` never joins a 0 to 2 animation. A name that finds nothing is tried
again without a trailing `-<n>`, so a duplicated layer shares its frames.

**Placement.** Frame 0's artwork is lined up with the layer's artwork, scaled by
their widths, so frames can be exported on their own artboard with their own
padding. Every frame is drawn the way frame 0 measures: one animation is one
artboard exported several times. If the frame's text is set in a font the browser
lacks, the frame's view is widened so a wider fallback font is not cut off.

**How it plays** is set per level in the sandbox test's `levelMap.animate`, by the
asset name, then `default`, then the game's `CFG.levelAnimateMode` (`loop`) and
`CFG.levelAnimateFPS` (6):

| mode | Plays |
| --- | --- |
| `loop` | 0 1 2 0 1 2 ... |
| `yoyo` | out and back without repeating either end: 0 1 2 1 0 1 2 ... |
| `hold` | frame 0 only |

It reports `animate:<asset-name>` once it has shown a full cycle.

No frames found leaves the layer in the background, still drawn, with a warning.
One frame found draws it live but warns that there is nothing to animate.

### BREAKABLE: scenery that breaks

```text
OBJECT-crate-stack
  BREAKABLE-crate-stack        optional: objects/crate-stack_damaged.svg, _broken.svg
```

The layer is cut out of the background and drawn on its own. It blocks movement,
takes hits, and breaks after `CFG.objBreakHits` blows (3 by default), the way the
game's crates do, in splinters of its own fill colors. It reports
`break:<name>`.

State art is optional and goes in the level's `objects/` folder:

| File | Shown |
| --- | --- |
| `<name>_damaged.svg` | after the first hit. Without it the piece shakes as itself |
| `<name>_broken.svg` | once broken. Without it the piece is simply gone |

Export state art on an artboard the size of the piece it replaces. The cut-out
keeps 6 units of room around the piece's box for strokes, which Illustrator's
measurements leave out.

A tall breakable is drawn in depth order by its bottom edge; better ordering for
tall pieces is **planned**.

### EVENT: trigger areas

An `EVENT-<name>` layer's box is an area on the ground. The first time the
player's feet are in it (walking or jumping across), it reports `event:<name>`,
once per run. On its own it does nothing else; a level design waits on it, for
example to start an ambush.

### negative-space: holes in the field

A `negative-space` layer (or `negative-space-2`, and so on) is a hole: nobody can
walk into it. Use a rect, polygon or polyline; any other shape is replaced by its
box, with a warning. It must sit inside `#field`, or movement around it breaks
(that is warned about too). Rushing enemies walk around holes; flanking and
holding enemies doing the same is **planned**.

## Naming a layer by path

A level design names places by layer path, not by coordinates:

| Path | Means |
| --- | --- |
| `ENTER-building` | the first `ENTER-building` (or numbered copy) in the level |
| `RESTRICTED-storage-room/ENTER-building` | the `ENTER-building` whose nearest mapped parent is `RESTRICTED-storage-room` |

Each part matches an id exactly or with Illustrator's `-<n>` suffix. Parents are
matched up the chain of mapped layers, nearest first, so ordinary groups in
between do not count. Paths tell two doors of the same name apart; in
`theStreets` they are `RESTRICTED-import-export-warehouse/ENTER-building` and
`ENTERABLE-bad-bar/ENTER-building`.

## Events a level reports

What the layers report, in the form a level design and the sandbox checklist
wait on:

| Event | When |
| --- | --- |
| `animate:<asset-name>` | an `ANIMATE` piece has shown a full cycle |
| `break:<name>` | a `BREAKABLE` piece breaks |
| `enter:<name>` | the player goes in through a door of that `ENTERABLE` or `RESTRICTED` |
| `exit:<name>` | the player comes back out of it |
| `interact:<name>` | E in an `OBJECT` area with nothing inside it |
| `event:<name>` | the player first steps into an `EVENT` area |
| `locked:<name>` | the player tries a locked `RESTRICTED` door (every try) |
| `unlock:<name>` | a `RESTRICTED` layer unlocks |

Each is reported once per run, except going through doors, `interact:` and
`locked:`, which report every time.

## Checking a level

With **Show Hitboxes** on in debug mode, every map id is outlined on the level
with its id: doors in green, objects in orange, animations in magenta,
breakables in yellow, holes in red, trigger areas in blue, locks in pink, planned
layers in grey.

SANDBOX TEST also prints the map as a table in the browser console (each id, its
kind, its parent and where it landed in the world) and warns about anything that
will not work as its name suggests:

- an id that looks like a map id but matches no rule (`ANIMTE-sign`)
- an `ENTERABLE` or `RESTRICTED` with no `ENTER-` door inside it
- a `RESTRICTED` with no `REQUIRE-` layer (fine when the level design names a condition)
- a `REQUIRE-` layer outside a `RESTRICTED`, or not written as `REQUIRE-<type>-<name>`
- two layers of one kind with the same name, whose events could not be told apart
- an `ENTER-` type that is not `building`, `exit` or `vehicle`
- an `ANIMATE` layer with no frames, or only one
- a hole outside `#field`, or a hole that is not a rect, polygon or polyline
- a layer with nothing to measure, such as an empty group
- a planned prefix (`SWITCH-lever`: recognised, but not built yet)

See [sandbox.md](sandbox.md) for setting up a test.

## Planned

- `ENTER-vehicle`: a different way of moving while driving
- `INVENTORY-`, `MISSING-`, `SWITCH-`, `USABLE-` and `REQUIRE-item-`
- an interior saved as a folder, with rooms of its own
- levels loaded from `config/levels.json` (today levels are tried in SANDBOX TEST)

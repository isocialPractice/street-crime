# Level Design Files

A level has two sources. The level SVG's layer names say **where and what**: the
walkable field, the doors, what breaks, what animates, where an item lies
([level-naming.md](level-naming.md)). A level design file says **when**: the gate
breaks, then three enemies walk out of the warehouse door, and once they are beaten
the warehouse opens.

The design is a small state machine. Its triggers are the events the level's
layers already report, such as `break:parking-gate-arm`, and its actions name
layers by path, such as `RESTRICTED-import-export-warehouse/ENTER-building`. It
never holds coordinates, and layer names never hold timing.

Also as a [quickstart](level-design_quickstart.md) and a [cheatsheet](level-design_cheatsheet.md).
Items, the item screen and the command line have a page of their own:
[inventory.md](inventory.md).

## Where it lives

```text
config/levels/<level>/level-design.json
config/schema/level-design.schema.json      describes every key, for editors
```

Start the file with `"$schema": "../../schema/level-design.schema.json"`. VS Code
then completes keys, lists allowed values and explains each one on hover, with no
extension.

Today a design runs in SANDBOX TEST, named by a test's `"design"` key (see
[sandbox.md](sandbox.md)). Loading real stages through `config/levels.json` is
**planned**, and will use the same file.

## A complete example

[`config/levels/theStreets/level-design.json`](../config/levels/theStreets/level-design.json):

```json
{
  "$schema": "../../schema/level-design.schema.json",
  "version": 1,
  "start": "initial",
  "groups": {
    "enemy": {
      "warehouse-crew": {
        "count": 3,
        "pick": "random",
        "order": "random",
        "every": 1,
        "pool": [
          "JumpingJunkie",
          "CrimeGuy",
          {
            "enemy": "CrimeGuy",
            "name": "gray-crimeguy",
            "render": { "left-vest": "gray", "right-vest": "gray", "front-leg": "gray", "back-leg": "gray" }
          }
        ]
      },
      "response-crew": {
        "order": "load",
        "from": "edges",
        "pool": [
          "JammingJabber",
          "BadGirl",
          { "enemy": "SassyGirl", "count": 2, "re-render": 1, "render": { "dress": "dark-gray" } }
        ]
      }
    }
  },
  "cases": {
    "start": true,
    "has-gate": true,
    "enemies-defeated": false,
    "has-key": { "condition": "inventory:key" },
    "warehouse-crew-down": { "condition": "alive:warehouse-crew = 0" },
    "response-crew-down": { "condition": "alive:response-crew = 0" }
  },
  "restricted": {
    "import-export-warehouse": { "until": "case:enemies-defeated", "type": "condition" }
  },
  "states": {
    "initial": {
      "svg": "loads",
      "set": { "start": true, "has-gate": true, "enemies-defeated": false },
      "player": { "spawn": "left", "after": 2, "animation": "walk", "inventory": "empty", "health": "full" },
      "next": [{ "on": "break:parking-gate-arm", "to": "gate-breaks" }]
    },
    "gate-breaks": {
      "svg": "layer-state-change",
      "set": { "start": false, "has-gate": false },
      "cases": { "enemies-defeated": { "condition": "alive = 0" } },
      "player": { "inventory": "inherit", "health": "inherit" },
      "spawn": [
        {
          "group": "warehouse-crew",
          "type": "enemy",
          "from": "RESTRICTED-import-export-warehouse/ENTER-building",
          "animation": "walk",
          "after": 0.5,
          "every": 0.8
        }
      ],
      "animate-layers": [
        { "layer": "door-glass-right", "position-x": 130, "position-y": 0, "type": "ease-out", "duration": 0.5 },
        { "layer": "door-glass-left", "position-x": -130, "position-y": 0, "type": "ease-out", "duration": 0.5 },
        { "layer": "door-handle-right", "position-x": 130, "position-y": 0, "type": "ease-out", "duration": 0.5 },
        { "layer": "door-handle-left", "position-x": -130, "position-y": 0, "type": "ease-out", "duration": 0.5 }
      ],
      "next": [{ "on": "defeated:warehouse-crew", "to": "enemy-defeat" }]
    },
    "enemy-defeat": {
      "svg": "none",
      "player": { "inventory": "store", "health": "store" },
      "next": [
        { "on": "exit:import-export-warehouse", "when": { "has-key": true }, "to": "response-fights" },
        { "on": "exit:import-export-warehouse", "to": "response-flees" }
      ]
    },
    "response-fights": {
      "svg": "none",
      "spawn": [{ "group": "response-crew", "type": "enemy" }],
      "next": [
        { "on": "exit:bad-bar", "when": { "response-crew-down": true, "warehouse-crew-down": true }, "to": "replay" }
      ]
    },
    "response-flees": {
      "svg": "none",
      "spawn": [{ "group": "response-crew", "type": "enemy", "then": "flee" }],
      "next": [
        { "on": "exit:bad-bar", "when": { "warehouse-crew-down": true }, "to": "gate-reset" },
        { "on": "exit:bad-bar", "when": { "warehouse-crew-down": false }, "to": "crew-returns" }
      ]
    },
    "gate-reset": {
      "svg": "none",
      "reset": ["break:parking-gate-arm"],
      "set": { "has-gate": true },
      "next": [{ "on": "break:parking-gate-arm", "to": "gate-breaks" }]
    },
    "crew-returns": {
      "svg": "none",
      "spawn": [{ "group": "warehouse-crew", "type": "enemy", "from": "edges", "inherit": true }],
      "next": [{ "on": "defeated:warehouse-crew", "to": "enemy-defeat" }]
    },
    "replay": {
      "svg": "fade-out",
      "reset": "level"
    }
  }
}
```

Read as a story:

1. **initial.** Two seconds after the level loads, the player walks in from the
   left. The warehouse is locked.
2. Breaking the parking gate arm moves the level to **gate-breaks**. The warehouse
   door's glass and handles slide apart, and the warehouse crew, defined once under
   `groups`, walks out 0.8 s apart: a JumpingJunkie, a CrimeGuy and a CrimeGuy with
   his vest and legs in gray, in random order. From here on, `enemies-defeated` is
   true while no enemy is left to beat.
3. When the last of them is down, the warehouse opens: its lock follows
   `enemies-defeated`. `defeated:warehouse-crew` moves the level to
   **enemy-defeat**, which stores the player's health and what they carry. A key
   lies inside the warehouse.
4. Walking out of the warehouse **with the key** moves the level to
   **response-fights**: the response crew (a JammingJabber, a BadGirl and two
   SassyGirls, one in dark gray) walks in from both edges of the view at once, and
   the warehouse locks again while they stand.
5. Walking out **without it** moves the level to **response-flees**: the same crew
   walks in, stands a moment, and runs off.
6. Leaving the bar then decides the rest:

| The response crew | The warehouse crew | On leaving the bar | Written as |
| --- | --- | --- | --- |
| fought and beaten | standing | everything as it was left | no step: what you leave is what you find |
| fighting, standing | beaten | everything as it was left | no step |
| ran off | beaten | the gate is whole again; breaking it starts the crew again | `response-flees` to `gate-reset` |
| ran off | standing | the warehouse crew comes back in from the edges, with the health they had | `response-flees` to `crew-returns` |
| fought and beaten | beaten | the screen fades and the level starts over | `response-fights` to `replay` |

In this file the warehouse stays locked until its crew is beaten, so the two rows
with that crew standing do not happen; they show what the keys can do.

## Top-level keys

| Key | Required | Is |
| --- | --- | --- |
| `$schema` | no | path to the schema, for editor help |
| `version` | yes | `1`. A file without it is a draft (see [Drafts](#drafts)) |
| `start` | yes | the state the level begins in |
| `groups` | no | spawn groups defined once, for states to spawn by name (see [Groups](#groups)) |
| `cases` | no | named flags, each a starting true or false or a condition to follow (see [Cases](#cases)) |
| `restricted` | no | unlock conditions for `RESTRICTED-<name>` layers, keyed by `<name>` |
| `look` | no | what LOOK on the command line says about things, by layer name ([inventory.md](inventory.md#names-and-the-designs-look)) |
| `states` | yes | the states, keyed by name |

## States

Each state is an object. Entering one does these, in order:

1. reports `state:<name>`
2. `reset`: puts things back as they started (once the screen is black, with `"svg": "fade-out"`)
3. `set`: changes cases
4. `spawn`: starts its spawn groups
5. `cases`: cases that follow a condition from here on
6. `animate-layers`: sets its layers moving
7. `player`: applies `health` and `inventory`, then starts the player's entrance
   (once the screen is black, with `"svg": "fade-out"`)

| Key | Is |
| --- | --- |
| `svg` | what the level art does: `loads` and `none` (nothing; `none` reads better on a later state), `layer-state-change` (a marker: the art changes through the layers themselves, such as a breakable's `_broken` art), `fade-out` (fade to black and back) |
| `set` | cases to change, such as `{ "gate-broken": true }`. Cases not listed keep their value. A case that was following a condition stops following it |
| `cases` | cases that follow a condition from this state on, such as `{ "all-clear": { "condition": "alive = 0" } }` (see [State cases](#state-cases)) |
| `reset` | what to put back, or `"level"` for all of it (see [Reset](#reset)) |
| `player` | see [Player](#player) |
| `spawn` | a list of spawn groups, see [Spawn groups](#spawn-groups) |
| `animate-layers` | a list of layers of the art to slide, see [Moving layers](#moving-layers) |
| `characters` | `friendly` and `neutral`: **planned**, write `false` or leave out |
| `next` | a list of `{ "on": <trigger>, "when": { ... }, "to": <state> }`. The first to fire wins (see [Steps that branch](#steps-that-branch-when)) |

A state with no `next` is where the level stays.

## Triggers

A trigger is `<kind>:<name>`. There are four sorts:

| Sort | Kinds | Fires |
| --- | --- | --- |
| Level events | `animate`, `break`, `enter`, `exit`, `interact`, `event`, `locked`, `unlock`, `lock` | when the level reports it (see [level-naming.md](level-naming.md#events-a-level-reports)) |
| Director events | `spawn:<group>`, `defeated:<group>`, `fled:<group>`, `arrive:<state>` | when the level design reports it (see [Reports](#reports)) |
| Player events | `take:<item>`, `use:<item>`, `drop:<item>`, `combine:<item>`, `look:<name>`, `talk:<name>` | every time the player does it ([inventory.md](inventory.md#what-a-level-design-reads)) |
| Conditions | `case:<name>`, `state:<name>` | while that case is true, or once that state has been entered |

How they fire depends on where they are written:

- In `next`, an **event** counts only if it is heard while that state is the
  current one. A **condition** fires as soon as it holds while that state is
  current, which can be the moment the state is entered.
- In `restricted`'s `until`, a trigger holds once it has been true at any point
  in the run, events included, unless the entry is `"type": "condition"`.

Several states can move on from each other in one frame (state A sets a case that
state B waits on). That stops after 16 moves, with a warning, in case two states
keep handing over to each other.

### Steps that branch: `when`

```json
"next": [
  { "on": "exit:import-export-warehouse", "when": { "has-key": true }, "to": "response-fights" },
  { "on": "exit:import-export-warehouse", "to": "response-flees" }
]
```

- `when` is an object of case names and `true` or `false`. The step fires only if
  every case listed has that value at that moment.
- `on` may be left out when `when` is given: the step then fires as soon as `when`
  holds while its state is current, the way a `case:` trigger does.
- The first step that fires wins, so a specific step goes before a general one.

## Cases

`cases` declares each case. A case either holds a value, given as its starting
`true` or `false` and changed by states with `set`, or follows a condition, read
every frame:

```json
"cases": {
  "alley-cleared": false,
  "has-crowbar": { "condition": "inventory:crowbar" },
  "gang-down": { "condition": "alive:alley-gang = 0" }
}
```

A condition is `<source>[:<name>] [<op> <whole number>]`, spaces optional:

| Source | Counts | With no op |
| --- | --- | --- |
| `alive` | enemies in play: standing, plus members of started groups still to come out, in every scene of the run (the street and the building the player is in). Enemies that ran off do not count | at least 1 |
| `alive:<group>` | that group's members still to beat: before the group has started, all its first spawn would bring; then those to come plus those standing | at least 1 |
| `fled:<group>` | that group's members that ran off | at least 1 |
| `inventory:<item>` | how many of that item the player carries | at least 1 |
| `inventory` | items carried, of every kind | at least 1 |
| `case:<name>` | that case is true (no op) | |
| `state:<name>` | that state has been entered this run (no op) | |

Ops: `=` (also `==`), `!=`, `<`, `<=`, `>`, `>=`.

`alive` counts every scene, so going into a building with a crew outside never
makes it 0, and neither does the moment before a crew's first member comes out.
A group that has not started is not in play, so a crew waiting for a later state
never keeps a door shut.

When a case **becomes true** the level reports `case:<name>` (cases that start true
are reported as the level starts), so a checklist row or a trigger can wait on a
case turning true. A case that turns false again is reported again when it next
turns true.

### State cases

```json
"gate-breaks": { "cases": { "enemies-defeated": { "condition": "alive = 0" } } }
```

From entering the state on, the case follows that condition, until a later state
gives it another condition or `set`s it. A state's `cases` take conditions only (a
value goes in `set`), and the case must be declared at the top, which gives its
value until then.

A case written before the format was known, `"enemies-defeated": "condition"` with
`"conditional": "length=0"` beside it, or `"has-key": "condition"` with
`"conditional": "player.inventory"` and `"player-inventory": "key"`, is read the
same, and the checks say what to write instead.

## Restricted

```json
"restricted": {
  "storage-room": { "until": "case:alarm-off" },
  "vault": { "until": "case:guards-down", "type": "condition" }
}
```

Each key is the `<name>` of a `RESTRICTED-<name>` layer. The layer stays locked
until its `until` trigger holds, then reports `unlock:<name>`. An entry here takes
the place of any `REQUIRE-` layer inside the `RESTRICTED`; without one, the
`REQUIRE-` layers decide ([level-naming.md](level-naming.md#restricted-locked-doors)).

| `type` | The door |
| --- | --- |
| `once` (default) | opens the first time `until` holds and stays open for the run |
| `condition` | is open while `until` holds. When it stops holding the door locks again, reporting `lock:<name>`; opening again reports `unlock:<name>` again |

Locks are on the way in: a player inside a building whose door locks behind them
can still leave.

## Player

| Key | Values | Does |
| --- | --- | --- |
| `spawn` | `left`, `right`, or a layer path | brings the player on. Leave out to keep the player where they are |
| `after` | seconds | how long the player stays off stage first |
| `animation` | `walk`, `idle` | walk in, or appear in place |
| `health` | `full`, `inherit`, `store` | refill, keep, or keep and store for the next level |
| `inventory` | `empty`, `inherit`, `store` | empty what the player carries, keep it, or keep it and store it for the next level ([inventory.md](inventory.md)) |

**The entrance.** For `after` seconds the player is off stage: not drawn, not hit,
no input. Then:

| `spawn` | Starts | Walks to |
| --- | --- | --- |
| `left` | off the level's left edge, camera at the start | the spawn band (the sandbox test's `spawn`, x 60 to 220 by default) |
| `right` | off the level's right edge, camera at the end | the band's mirror at the right |
| a layer path | the layer's foot, such as a door | the ground just below it, the way enemies come out of a door |

The player cannot be hit while walking in. Once they arrive, the level reports
`arrive:<state>`, so another step can wait until the player is on screen.

`store` keeps the player's health and what they carry for the next level to pick
up. Loading the next level is **planned**; until then the debug overlay shows what
was stored.

## Spawn groups

```json
"spawn": [{
  "group": "warehouse-crew",
  "type": "enemy",
  "from": "RESTRICTED-import-export-warehouse/ENTER-building",
  "animation": "walk",
  "after": 0.5,
  "every": 0.8
}]
```

| Key | Required | Is |
| --- | --- | --- |
| `group` | yes | the group's name, used by `spawn:<group>`, `defeated:<group>` and `fled:<group>`, and the group under `groups` it spawns, if there is one |
| `type` | yes, unless the group is under `groups` | `enemy` (friendly and neutral characters are **planned**) |
| `from` | yes, here or in the group | the layer they come out of, as a path, or `edges`: from just off the view's left and right edges, taking turns |
| `count` | no | how many. Left out: every enemy the pool brings (each entry its own `count`), or 1 with no pool |
| `pick` | no | `random` (default): from the pool without repeats until it runs out. `in-order`: the pool's entries in turn |
| `pool` | no | the enemies to pick from, see [Pool entries](#pool-entries). Default: every enemy that is not a sub-boss or boss and has artwork |
| `order` | no | the order they come out in, see [Order](#order) |
| `animation` | no | `walk` (default): walk in before fighting. `idle`: appear in place |
| `after` | no | seconds after entering the state before the first one |
| `every` | no | seconds between the rest. 0 or left out: all at once. Also read when written `timeout`, with a note |
| `then` | no | `fight` (default), or `flee`: once in, they stand a moment, then run off the nearer edge of the view and are gone |
| `inherit` | no | `true`: bring back the members of this group's last spawn still standing, with the health they had, instead of new ones |

Out of a layer, each enemy appears at its foot and walks down onto the ground
below it, in lanes (middle, left, right, further left, further right; a sixth and
more a row deeper) so they do not stack. From `edges`, they come in from just off
the view's sides, first the left then the right, and walk to a place 60 to 140 px
inside the view, at the player's depth. An enemy cannot be hit until it arrives,
then its fighting starts. A group only spawns while the player is in the scene its
layer is in: if they are inside a building, the group waits for them to come back
out.

The level reports `spawn:<group>` when the first one appears, and, once all of them
have appeared and are gone, `defeated:<group>`, or `fled:<group>` if any of them ran
off.

### Groups

A crew can be written once, under `groups`, by spawn type and name, and spawned by
any state that names it:

```json
"groups": {
  "enemy": {
    "alley-gang": {
      "pick": "random",
      "every": 1,
      "pool": ["CrimeGuy", "BadGirl"]
    }
  }
},
"states": {
  "ambush": {
    "spawn": [{ "group": "alley-gang", "from": "ENTERABLE-corner-shop/ENTER-building", "every": 0.6 }]
  }
}
```

A group takes every spawn key but `group` and `type`, which are where it is filed.
A state's spawn lays its own keys over the group's, key by key: above, `every` is
0.6. A list (`pool`, `order`) is replaced whole, never merged. `type` may be left
out of the spawn when the group is filed under one type only. A group may be
spawned by several states; one state spawning the same group twice is warned about.

### Order

`pick` says which members come; `order` says when each comes out:

| `order` | Comes out |
| --- | --- |
| `random` | in a shuffled order |
| `sequence` | in pool order (an entry with `count` 2 gives two in a row) |
| `reverse` | in reversed pool order |
| `same` (also `load`) | all at once; `every` is not used |
| a list, such as `["gray-crimeguy", "JumpingJunkie"]` | those first, in that order, then the rest in pool order. A name is an entry's `name`, an enemy's id or art name in any case (a plain one before a recolored one), or a pool position from 1 |

Left out: all at once (`same`) when the state was entered through a door (its step
fired on `enter:` or `exit:`), since the scene is new to the player either way;
otherwise the order `pick` drew them in.

### Pool entries

A pool entry is one of:

| Entry | Is |
| --- | --- |
| `"crimeguy"`, `"CrimeGuy"` | one of an enemy, by its id in `js/entities/enemy.js` or its art name, in any case |
| `{ "enemy": "CrimeGuy", "count": 2 }` | two of it |
| `{ "enemy": "SassyGirl", "count": 2, "re-render": 1, "render": { "dress": "dark-gray" } }` | two of it, the first `re-render` of them (default: all) with some parts recolored |

An object entry's keys:

| Key | Is |
| --- | --- |
| `enemy` | the enemy, as above |
| `count` | how many of it, default 1 |
| `render` | parts of its art to recolor, each part (a layer name, such as `left-vest`) to a palette in `config/palettes.json` (such as `gray`) |
| `re-render` | how many of `count` are drawn with the `render`; the rest are drawn as the enemy is |
| `name` | a name for the entry, for `order` lists and the debug box, such as `"gray-crimeguy"` |

Every shape in a rendered part takes the palette's color for its tone, read from
its layer name: a layer named `vest-mid` takes the palette's `mid`. How parts and
tones are found is in [character-assets.md](character-assets.md#recoloring-parts).

The files on disk are never changed: the recolored frames are made when the level
starts, and SANDBOX TEST waits for them before play begins. Each render is its own
enemy, with the id `<enemy id>~<parts>`, such as
`jumpingjunkie~left-vest=gray,right-vest=gray`; that is the id the debug box and
the console show. A pool entry can also be written before the format is known, as
`JumpingJunkie:render([left-vest.background(gray)])`, or with its enemy as an object,
`{ "enemy": { "name": "SassyGirl", "count": 2 } }`: a draft converts both, and a
version 1 file is told the object to write instead.

### Coming back and running off

```json
"spawn": [
  { "group": "alley-gang", "from": "edges", "inherit": true },
  { "group": "lookouts", "from": "edges", "then": "flee" }
]
```

- **`inherit`** brings back the members of the group's last spawn still standing,
  wherever they are (this scene, or kept in the street while the player was
  inside), with the health they had. Members already beaten stay beaten. `count`,
  `pick`, `pool` and `order` are not used. With nobody standing, nobody comes, and
  the group reports `defeated:<group>` at once.
- **`"then": "flee"`** has each member, once in, stand for a moment (the **Stand
  Before Run** setting, 1.2 s), then run off the nearer edge of the view, faster
  than it walks (**Run Speed**, 1.6 times), and be gone. They cannot be hit while
  they stand or run. TALK on the command line gets a rude answer from them.

## Moving layers

```json
"animate-layers": [
  { "layer": "shutter-left", "position-x": -120, "type": "ease-out", "duration": 0.5 },
  { "layer": "loading-bay/shutter-right", "position-x": 120, "type": "ease-out", "duration": 0.5, "after": 0.2 }
]
```

| Key | Required | Is |
| --- | --- | --- |
| `layer` | yes | the layer to move, by its name in the art, as a path (below) |
| `position-x` | no | where it goes across, measured from where the art draws it. Negative is left. Left out: it stays where it is across |
| `position-y` | no | the same, up and down. Negative is up |
| `type` | no | how it travels: `linear` (default, one speed), `ease-in` (starts slow), `ease-out` (ends slow), `ease-in-out` |
| `duration` | no | seconds to get there. 0 or left out: at once |
| `after` | no | seconds after entering the state before it starts |

**Units.** Positions are in the level SVG's own units, the numbers Illustrator
shows for the level's artboard, so a pane of glass 130 wide slides its own width
with `130`. The game scales them the way it scales the art.

**Where, not how far.** A position is measured from where the art draws the
layer, not from where it is now. A later state sends it back with `0`, and a
layer sent to `130` twice moves once.

**Which layer.** `layer` can name any layer of the art, not only the
upper-case map names. The last part is the layer's name; Illustrator's numbered
copies (`shutter-left-2`) match it too. Parts before it are layers it sits
inside, further up and in order, with any groups in between: `loading-bay/shutter-right`
is the `shutter-right` somewhere inside `loading-bay`. Name a parent when two
layers share a name; otherwise the first one in the file moves, with a warning.

**What it looks like.** The layer is cut out of the background and drawn on its
own, but it keeps its place in the stacking order: art drawn over it in
Illustrator, such as a door frame over its glass, stays over it while it moves,
and art under it shows where it was. Several layers moving through the same area
are drawn together, in the file's order.

The level reports `animate:<layer>` the first time a layer gets where it was sent,
so a checklist row or a `next` step can wait for a door to finish opening.
RESTART puts every layer back where the art draws it.

A layer cannot move when it is, or is inside, an `ANIMATE-` or `BREAKABLE-` piece
(those are drawn on their own), or when it sits inside or holds another layer
that moves. Only the level SVG's layers can move; layers inside an interior
cannot yet.

## Reset

A state's `reset` puts things back as they were at the start of the run:

| `reset` | Puts back |
| --- | --- |
| a list, such as `["break:parking-gate-arm"]` | each thing named the way it reports: `break:<name>` (the piece is whole again and can break again), `animate:<layer>` (the layer back where the art draws it), `unlock:<name>` (locked again), `case:<name>` (its starting value, and its condition if the top `cases` gives it one) |
| `"level"` | the whole run: every breakable whole, every moved layer back, every lock closed, every case at its starting value, items back where the level's layers put them, the street's enemies, pickups and effects gone, and nothing reported, visited or heard. Then the start state is entered, so its `player` rules decide the player's health and what they carry. A player inside a building is first taken back out to the street |

`reset` runs on entering the state; with `"svg": "fade-out"` it waits for the
screen to be black, so the level starting over is not seen happening.

## Reports

What a level design adds to the events a level reports:

| Event | When |
| --- | --- |
| `state:<name>` | a state is entered |
| `case:<name>` | a case becomes true |
| `spawn:<group>` | the first of a group appears |
| `defeated:<group>` | all of a group have appeared and are gone, none having run off |
| `fled:<group>` | all of a group have appeared and are gone, some having run off |
| `arrive:<state>` | the player has finished coming on for that state |
| `unlock:<name>` | a `RESTRICTED` layer unlocks (reported by the level, opened by the design) |
| `lock:<name>` | a `RESTRICTED` that follows a condition locks again |
| `animate:<layer>` | a moving layer has got where it was sent (reported by the level) |

What the player does is reported every time: `take:`, `use:`, `drop:` and
`combine:` with items, and `look:` and `talk:` on the command line
([inventory.md](inventory.md#what-a-level-design-reads)).

Every other report is sent once per run, except what can happen more than once,
which is forgotten so it is heard again: a group starting again forgets its
`spawn:`, `defeated:` and `fled:`; a `reset` forgets what it puts back; a lock
locking again forgets its `unlock:`; a case turning false forgets its `case:`.
RESTART is a new run: everything is reported again, every lock closes again, and
the level starts over at `start`.

## Drafts

A file with no `version` is read as a draft, the shape a level design takes when
it is written down before the format is known, and converted to version 1 in
memory. The file is never changed. SANDBOX TEST notes each change in the console,
then prints the whole file as version 1, ready to save over the draft.

| Draft | Version 1 |
| --- | --- |
| `"states": ["a", "b"]`, with each state beside it | `"start": "a"`, `"states": { "a": {...}, "b": {...} }` |
| `"case": ["x"]` | `"cases": { "x": <starting value> }`, the value from the first state's `set-case` |
| `"set-case"` | `"set"` |
| `"characters": { "player": {...} }` | `"player"` |
| `"spawn-position"`, `"spaw-position"` | `"spawn"` (player) or `"from"` (enemies) |
| `"spawns-after": "2 seconds"` | `"after": 2` (`"1.5s"` and `"500ms"` work too, and in spawns and `animate-layers` for `every`, `duration` and `after`) |
| `"spawn-animation"` | `"animation"` |
| `"spawned"` | not needed: a player with a `spawn` comes on |
| `"characters": { "enemy": {...} }` | a spawn group named `<state>-enemies` |
| `"assets": "random"` | `"pick": "random"` |
| `"pick": ["CrimeGuy", ...]`, a list | `"pool": ["CrimeGuy", ...]`, with `"pick": "random"` |
| `"timeout": "1s"` in a spawn or group | `"every": 1` |
| `"JumpingJunkie:render([left-vest.background(gray)])"` in a pool | `{ "enemy": "JumpingJunkie", "render": { "left-vest": "gray" } }` (`fill(...)` reads the same as `background(...)`) |
| `{ "enemy": { "name": "SassyGirl", "count": 2 } }` in a pool | `{ "enemy": "SassyGirl", "count": 2 }` |
| `"x": "condition"` with `"conditional": "length=0"` beside it | `"x": { "condition": "alive = 0" }` (and with `"conditional": "player.inventory"`, `"player-inventory": "key"`: `{ "condition": "inventory:key" }`) |
| `"a, b"` as a position | the path `"a/b"` |
| `"events": { "breakable-x": "break:met" }` on state b | `"next": [{ "on": "break:x", "to": "b" }]` on the state before b |
| a later state nothing leads to, after one that spawns enemies | `"next": [{ "on": "defeated:<group>", "to": ... }]` on the state before it |

A draft's `groups` are converted the same way as its spawns. A state's condition
for a case the draft's `cases` does not list adds it, starting false.

In a draft, a layer path that names nothing is corrected to the closest real one,
and the note says so: `RESTRICTED-building-warehouse/ENTER-building` becomes
`RESTRICTED-import-export-warehouse/ENTER-building` by the word "warehouse". In a
version 1 file it is only suggested.

`config/debug/designs/5-draft.json` is a real draft kept for the sandbox's step 5.

## Checking a design

Every time a sandbox test starts, its design is checked against the level SVG.
Each problem is printed to the console, and the status line shows the count. A
problem with a name offers the nearest real one:

```text
state "initial" next #1 "on" waits on "break:parking-gate", but the level SVG has no
  BREAKABLE-parking-gate; did you mean "break:parking-gate-arm"?
state "initial" next #1 goes to "gate-brakes", which is not in "states"; did you mean "gate-breaks"?
state "gate-breaks" spawn "crew" "pool" #2 names "crimguy", which is not an enemy; did you mean "crimeguy"?
state "gate-breaks" spawn "crew" "pool" #3 "render" "rite-vest": JumpingJunkie.svg has no layer
  named "rite-vest"; did you mean "right-vest"?
group "alley-gang" "order" lists "CrimeGuy" more times than the pool has of it
case "a1" "condition": "alvie" is not a condition source; did you mean "alive"? use one of alive, fled, inventory, case, state
case "k" "condition" counts item "kye", which is not in config/debug/items.json; did you mean "key"?
restricted "vault" "type" is "conditional"; did you mean "condition"? use one of once, condition
state "a" "reset" "brake:gate": write what to put back as <kind>:<name>, the kind one of break, animate, unlock, case; did you mean "break:"?
state "orphan" is never reached from "initial"
```

What is checked: every key and value, that `start` and every `to` are states, that
every case used is declared, that every condition reads a source that exists and
names a group, case, state or item that exists, that every trigger names something
the level has, that every layer path finds a layer (and every moving layer can
move), that every enemy exists, that every render's palettes exist and its parts are
in the enemy's art (`<Name>.svg`), that every group under `groups` is spawned and
every `order` name finds a member, that every `look` names a layer, and that every
state can be reached. Item names are checked when the test names an item catalog.
A design with problems still runs as far as it can.

With **Show Hitboxes** on, a box in the bottom-left corner shows the current state,
every case (T or F, with the condition it follows), what is still locked, each
spawn group's standing, to-come, down and fled counts, what the player carries, the
player's entrance, and what was stored. Each area that moving layers are redrawn in
has a dashed outline labelled `MOVES` and the layers' ids, and the console lists the
moving layers and how far each goes.

The schema and the game's own list of words are kept in step by a check, which also
runs sample conditions through both:

```sh
node scripts/checkLevelDesignVocab.js
```

## Planned

- loading real stages through `config/levels.json`, carrying `store`d values between levels
- friendly and neutral characters
- `svg` actions that show and hide layers by path
- `extends`, for states shared between levels
- rosters: picking enemies by tier, not only by id

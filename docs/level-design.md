# Level Design Files

A level has two sources. The level SVG's layer names say **where and what**: the
walkable field, the doors, what breaks, what animates ([level-naming.md](level-naming.md)).
A level design file says **when**: the gate breaks, then three enemies walk out of
the warehouse door, and once they are beaten the warehouse opens.

The design is a small state machine. Its triggers are the events the level's
layers already report, such as `break:parking-gate-arm`, and its actions name
layers by path, such as `RESTRICTED-import-export-warehouse/ENTER-building`. It
never holds coordinates, and layer names never hold timing.

Also as a [quickstart](level-design_quickstart.md) and a [cheatsheet](level-design_cheatsheet.md).

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

`config/levels/theStreets/level-design.json`:

```json
{
  "$schema": "../../schema/level-design.schema.json",
  "version": 1,
  "start": "initial",
  "cases": { "start": true, "has-gate": true, "enemies-defeated": false },
  "restricted": {
    "import-export-warehouse": { "until": "case:enemies-defeated" }
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
      "player": { "inventory": "inherit", "health": "inherit" },
      "spawn": [{
        "group": "warehouse-crew", "type": "enemy", "count": 3, "pick": "random",
        "from": "RESTRICTED-import-export-warehouse/ENTER-building",
        "animation": "walk", "after": 0.5, "every": 0.8
      }],
      "next": [{ "on": "defeated:warehouse-crew", "to": "enemy-defeat" }]
    },
    "enemy-defeat": {
      "svg": "fade-out",
      "set": { "enemies-defeated": true },
      "player": { "spawn": "left", "after": 2, "animation": "walk", "inventory": "store", "health": "store" }
    }
  }
}
```

Read as a story:

1. **initial.** Two seconds after the level loads, the player walks in from the
   left. The warehouse is locked, because `enemies-defeated` is false.
2. Breaking the parking gate arm reports `break:parking-gate-arm`, which moves the
   level to **gate-breaks**. Half a second later the first of three random enemies
   walks out of the warehouse door, and the others follow 0.8 s apart.
3. When all three are beaten, `defeated:warehouse-crew` moves the level to
   **enemy-defeat**. The screen fades, the player's health is stored, and they walk
   back in from the left. `enemies-defeated` is now true, so the warehouse unlocks.

## Top-level keys

| Key | Required | Is |
| --- | --- | --- |
| `$schema` | no | path to the schema, for editor help |
| `version` | yes | `1`. A file without it is a draft (see [Drafts](#drafts)) |
| `start` | yes | the state the level begins in |
| `cases` | no | named true/false flags and their starting values |
| `restricted` | no | unlock conditions for `RESTRICTED-<name>` layers, keyed by `<name>` |
| `states` | yes | the states, keyed by name |

## States

Each state is an object. Entering one does these, in order:

1. reports `state:<name>`
2. `set`: changes cases
3. `spawn`: starts its spawn groups
4. `player`: applies `health` and `inventory`, then starts the player's entrance
   (once the screen is black, with `"svg": "fade-out"`)

| Key | Is |
| --- | --- |
| `svg` | what the level art does: `loads` (nothing), `layer-state-change` (a marker: the art changes through the layers themselves, such as a breakable's `_broken` art), `fade-out` (fade to black and back) |
| `set` | cases to change, such as `{ "gate-broken": true }`. Cases not listed keep their value |
| `player` | see [Player](#player) |
| `spawn` | a list of spawn groups, see [Spawn groups](#spawn-groups) |
| `characters` | `friendly` and `neutral`: **planned**, write `false` or leave out |
| `next` | a list of `{ "on": <trigger>, "to": <state> }`. The first to fire wins |

A state with no `next` is where the level stays.

## Triggers

A trigger is `<kind>:<name>`. There are three sorts:

| Sort | Kinds | Fires |
| --- | --- | --- |
| Level events | `animate`, `break`, `enter`, `exit`, `interact`, `event`, `locked`, `unlock` | when the level reports it (see [level-naming.md](level-naming.md#events-a-level-reports)) |
| Director events | `spawn:<group>`, `defeated:<group>`, `arrive:<state>` | when the level design reports it (see [Reports](#reports)) |
| Conditions | `case:<name>`, `state:<name>` | while that case is true, or once that state has been entered |

How they fire depends on where they are written:

- In `next`, an **event** counts only if it is heard while that state is the
  current one. A **condition** fires as soon as it holds while that state is
  current, which can be the moment the state is entered.
- In `restricted`'s `until`, a trigger holds once it has been true at any point
  in the run, events included.

Several states can move on from each other in one frame (state A sets a case that
state B waits on). That stops after 16 moves, with a warning, in case two states
keep handing over to each other.

## Cases

`cases` declares each case with its starting value. States change them with
`set`. When a case **becomes true** the level reports `case:<name>` (cases that
start true are reported as the level starts), so a checklist row or a trigger can
wait on a case turning true, not on it turning false.

## Restricted

```json
"restricted": {
  "storage-room": { "until": "case:alarm-off" }
}
```

Each key is the `<name>` of a `RESTRICTED-<name>` layer. The layer stays locked
until its `until` trigger holds, then reports `unlock:<name>` and stays unlocked
for the run. An entry here takes the place of any `REQUIRE-` layer inside the
`RESTRICTED`; without one, the `REQUIRE-` layers decide ([level-naming.md](level-naming.md#restricted-locked-doors)).

## Player

| Key | Values | Does |
| --- | --- | --- |
| `spawn` | `left`, `right`, or a layer path | brings the player on. Leave out to keep the player where they are |
| `after` | seconds | how long the player stays off stage first |
| `animation` | `walk`, `idle` | walk in, or appear in place |
| `health` | `full`, `inherit`, `store` | refill, keep, or keep and store for the next level |
| `inventory` | `empty`, `inherit`, `store` | the same for the inventory. **Planned:** there is no inventory yet, so this only records the choice |

**The entrance.** For `after` seconds the player is off stage: not drawn, not hit,
no input. Then:

| `spawn` | Starts | Walks to |
| --- | --- | --- |
| `left` | off the level's left edge, camera at the start | the spawn band (the sandbox test's `spawn`, x 60 to 220 by default) |
| `right` | off the level's right edge, camera at the end | the band's mirror at the right |
| a layer path | the layer's foot, such as a door | the ground just below it, the way enemies come out of a door |

The player cannot be hit while walking in. Once they arrive, the level reports
`arrive:<state>`, so another step can wait until the player is on screen.

`store` keeps the player's health (and the inventory word) for the next level to
pick up. Loading the next level is **planned**; until then the debug overlay shows
what was stored.

## Spawn groups

```json
"spawn": [{
  "group": "warehouse-crew",
  "type": "enemy",
  "count": 3,
  "pick": "random",
  "from": "RESTRICTED-import-export-warehouse/ENTER-building",
  "animation": "walk",
  "after": 0.5,
  "every": 0.8
}]
```

| Key | Required | Is |
| --- | --- | --- |
| `group` | yes | the group's name, used by `spawn:<group>` and `defeated:<group>` |
| `type` | yes | `enemy` (friendly and neutral characters are **planned**) |
| `from` | yes | the layer they come out of, as a path |
| `count` | no | how many, default 1 |
| `pick` | no | `random` (default): from the pool without repeats until it runs out. `in-order`: the pool's ids in turn |
| `pool` | no | enemy ids to pick from. Default: every enemy that is not a sub-boss or boss and has artwork |
| `animation` | no | `walk` (default): walk out of the layer before fighting. `idle`: appear in place |
| `after` | no | seconds after entering the state before the first one |
| `every` | no | seconds between the rest. 0 or left out: all at once |

Each enemy appears at the foot of the `from` layer and walks down onto the ground
below it, in lanes (middle, left, right) so they do not stack. It cannot be hit
until it arrives, then its fighting starts. A group only spawns while the player is
in the scene its layer is in: if they are inside a building, the group waits for
them to come back out.

The level reports `spawn:<group>` when the first one appears, and
`defeated:<group>` once all of them have appeared and their bodies have faded.

## Reports

What a level design adds to the events a level reports:

| Event | When |
| --- | --- |
| `state:<name>` | a state is entered |
| `case:<name>` | a case becomes true |
| `spawn:<group>` | the first of a group appears |
| `defeated:<group>` | all of a group have appeared and are gone |
| `arrive:<state>` | the player has finished coming on for that state |
| `unlock:<name>` | a `RESTRICTED` layer unlocks (reported by the level, opened by the design) |

Every report is sent once per run. RESTART is a new run: everything is reported
again, every lock closes again, and the level starts over at `start`.

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
| `"spawns-after": "2 seconds"` | `"after": 2` (`"1.5s"` and `"500ms"` work too) |
| `"spawn-animation"` | `"animation"` |
| `"spawned"` | not needed: a player with a `spawn` comes on |
| `"characters": { "enemy": {...} }` | a spawn group named `<state>-enemies` |
| `"assets": "random"` | `"pick": "random"` |
| `"a, b"` as a position | the path `"a/b"` |
| `"events": { "breakable-x": "break:met" }` on state b | `"next": [{ "on": "break:x", "to": "b" }]` on the state before b |
| a later state nothing leads to, after one that spawns enemies | `"next": [{ "on": "defeated:<group>", "to": ... }]` on the state before it |

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
state "gate-breaks" spawn "crew" "pool" names "crimguy", which is not an enemy; did you mean "crimeguy"?
state "orphan" is never reached from "initial"
```

What is checked: every key and value, that `start` and every `to` are states, that
every case used is declared, that every trigger names something the level has,
that every layer path finds a layer, that every enemy id exists, and that every
state can be reached. A design with problems still runs as far as it can.

With **Show Hitboxes** on, a box in the bottom-left corner shows the current state,
every case (T or F), what is still locked, each spawn group's count, the player's
entrance, and what was stored.

The schema and the game's own list of words are kept in step by a check:

```sh
node scripts/checkLevelDesignVocab.js
```

## Planned

- loading real stages through `config/levels.json`, carrying `store`d values between levels
- an inventory, and `REQUIRE-item-` locks
- friendly and neutral characters
- `svg` actions that show and hide layers by path
- `extends`, for states shared between levels
- rosters: picking enemies by tier, not only by id

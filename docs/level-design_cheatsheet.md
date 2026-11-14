# Level Design Cheatsheet

`config/levels/<level>/level-design.json`. Words below are `LEVEL_DESIGN_VOCAB` in
`js/level/level-design.js`. For the reasons behind each rule, see
[level-design.md](level-design.md); items are in [inventory.md](inventory.md).

## Shape

```json
{ "$schema": "../../schema/level-design.schema.json", "version": 1, "start": "a",
  "groups": { "enemy": { "<group>": { "pool", "order", "every", ... } } },
  "cases": { "x": false, "y": { "condition": "alive = 0" } },
  "restricted": { "<RESTRICTED name>": { "until": "<trigger>", "type": "once" } },
  "look": { "<layer name>": "what LOOK says" },
  "states": { "a": { "svg", "set", "cases", "reset", "player", "spawn", "animate-layers", "characters", "next" } } }
```

## State keys

Entering a state: report `state:`, `reset`, `set`, `spawn`, `cases`, `animate-layers`, `player`.

| Key | Value |
| --- | --- |
| `svg` | `loads`, `none` (both: nothing), `layer-state-change`, `fade-out` |
| `set` | `{ "<case>": true or false }`; stops a case following a condition |
| `cases` | `{ "<case>": { "condition": "..." } }`: follows it from this state on |
| `reset` | `"level"`, or `["break:<n>", "animate:<layer>", "unlock:<n>", "case:<n>"]` |
| `player` | `spawn`, `after`, `animation`, `inventory`, `health` |
| `spawn` | `[ { group, type, count, pick, pool, order, from, animation, after, every, then, inherit } ]` |
| `animate-layers` | `[ { layer, position-x, position-y, type, duration, after } ]` |
| `characters` | `friendly`, `neutral`: **planned**, `false` only |
| `next` | `[ { "on": "<trigger>", "when": { "<case>": true }, "to": "<state>" } ]`, first to fire wins; `on` optional with `when` |

## Player

| Key | Values |
| --- | --- |
| `spawn` | `left`, `right`, layer path |
| `after` | seconds off stage first |
| `animation` | `walk`, `idle` |
| `health` | `full`, `inherit`, `store` |
| `inventory` | `empty`, `inherit`, `store` (what the player carries) |

## Spawn group

| Key | Values | Default |
| --- | --- | --- |
| `group` | name; also the group under `groups` it spawns | required |
| `type` | `enemy` | required, unless under `groups` |
| `from` | layer path, or `edges` | required, here or in the group |
| `count` | 1 or more | the pool's total, or 1 with no pool |
| `pick` | `random`, `in-order` | `random` |
| `pool` | names (id or art name, any case), or `{ "enemy", "count", "re-render", "render", "name" }` | non-boss enemies with art |
| `order` | `random`, `sequence`, `reverse`, `same` (`load`), or `[names]` | `same` after a door, else as picked |
| `animation` | `walk`, `idle` | `walk` |
| `after`, `every` | seconds (`timeout` read as `every`) | 0 |
| `then` | `fight`, `flee` | `fight` |
| `inherit` | `true`: the last spawn's members still standing come back | |

`groups.<type>.<name>` takes every spawn key but `group` and `type`; a state's spawn
wins key by key, lists replaced whole. A pool entry's `render` recolors parts by
tone (`vest-mid` takes the palette's `mid`); palettes are `config/palettes.json`.
Its enemy's id is `<id>~<part>=<palette>,...`.

## Conditions

`"<case>": { "condition": "<source>[:<name>] [<op> <n>]" }`, read every frame.

| Source | Counts | No op |
| --- | --- | --- |
| `alive` | enemies in play, in every scene, with started groups' members still to come | at least 1 |
| `alive:<group>` | still to beat (before it starts: all it will bring) | at least 1 |
| `fled:<group>` | ran off | at least 1 |
| `inventory:<item>`, `inventory` | carried | at least 1 |
| `case:<name>`, `state:<name>` | true; entered (no op) | |

Ops: `=` `==` `!=` `<` `<=` `>` `>=`.

## Restricted

`until` + `type`: `once` (default, stays open) or `condition` (open while it holds;
locking again reports `lock:<name>`).

## Moving layer

| Key | Values | Default |
| --- | --- | --- |
| `layer` | any layer's name, or `parent/name` | required |
| `position-x`, `position-y` | level SVG units from where the art draws it; `0` is back | stays put |
| `type` | `linear`, `ease-in`, `ease-out`, `ease-in-out` | `linear` |
| `duration`, `after` | seconds | 0 |

Keeps its stacking order. Reports `animate:<layer>` on arrival. Not an `ANIMATE-` or
`BREAKABLE-` piece, nor inside or around another moving layer.

## Triggers

| Kind | Fires | In `next` |
| --- | --- | --- |
| `animate:` `break:` `enter:` `exit:` `interact:` `event:` `locked:` `unlock:` `lock:` | level reports it | event: while state is current |
| `spawn:<group>` `defeated:<group>` `fled:<group>` `arrive:<state>` | design reports it | event: while state is current |
| `take:` `use:` `drop:` `combine:` `<item>`, `look:<name>`, `talk:<name>` | the player does it | event: while state is current |
| `case:<name>` | case is true | condition |
| `state:<name>` | state was entered | condition |

`until` holds once its trigger has ever held (unless `"type": "condition"`). Max 16
state moves per frame.

## Reports

`state:<name>` · `case:<name>` (becomes true) · `spawn:<group>` (first out) ·
`defeated:<group>` (all gone) · `fled:<group>` (all gone, some ran) · `arrive:<state>`
(player in place) · `unlock:<name>` · `lock:<name>` · `animate:<layer>` (a moving
layer arrived). Once per run each, except what can happen again: a group starting
again, a `reset`, a lock locking again, a case turning false. Player events: every time.

## Drafts

No `version`: converted in memory, changes noted, v1 printed to the console.
`set-case` → `set`, `characters.player` → `player`, `characters.enemy` → spawn group
`<state>-enemies`, `"2 seconds"` → `2`, `"a, b"` → `"a/b"`, `events` → `next` on the
state before, a `pick` list → `pool`, `"Name:render([part.background(palette)])"` →
`{ "enemy", "render" }`, `{ "enemy": { "name" } }` → flat, `timeout` → `every`,
`"x": "condition"` + `"conditional": "length=0"` → `{ "condition": "alive = 0" }`.

## Check it

SANDBOX TEST status line: `design: N warnings`; console lists them with "did you
mean". **Show Hitboxes**: state box bottom-left (cases with their conditions, groups,
what is carried). `node scripts/checkLevelDesignVocab.js`.

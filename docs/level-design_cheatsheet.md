# Level Design Cheatsheet

`config/levels/<level>/level-design.json`. Words below are `LEVEL_DESIGN_VOCAB` in
`js/level/level-design.js`. For the reasons behind each rule, see
[level-design.md](level-design.md).

## Shape

```json
{ "$schema": "../../schema/level-design.schema.json", "version": 1, "start": "a",
  "cases": { "x": false },
  "restricted": { "<RESTRICTED name>": { "until": "<trigger>" } },
  "states": { "a": { "svg", "set", "player", "spawn", "animate-layers", "characters", "next" } } }
```

## State keys

| Key | Value |
| --- | --- |
| `svg` | `loads`, `layer-state-change`, `fade-out` |
| `set` | `{ "<case>": true or false }` |
| `player` | `spawn`, `after`, `animation`, `inventory`, `health` |
| `spawn` | `[ { group, type, count, pick, pool, from, animation, after, every } ]` |
| `animate-layers` | `[ { layer, position-x, position-y, type, duration, after } ]` |
| `characters` | `friendly`, `neutral`: **planned**, `false` only |
| `next` | `[ { "on": "<trigger>", "to": "<state>" } ]`, first to fire wins |

## Player

| Key | Values |
| --- | --- |
| `spawn` | `left`, `right`, layer path |
| `after` | seconds off stage first |
| `animation` | `walk`, `idle` |
| `health` | `full`, `inherit`, `store` |
| `inventory` | `empty`, `inherit`, `store` (**planned**: recorded only) |

## Spawn group

| Key | Values | Default |
| --- | --- | --- |
| `group` | name | required |
| `type` | `enemy` | required |
| `from` | layer path | required |
| `count` | 1 or more | 1 |
| `pick` | `random`, `in-order` | `random` |
| `pool` | enemy ids or art names, any case; or `{ "enemy", "render": { "<part>": "<palette>" } }` | non-boss enemies with art |
| `animation` | `walk`, `idle` | `walk` |
| `after`, `every` | seconds | 0 |

A render recolors a part's shapes by tone (`vest-mid` takes the palette's `mid`);
palettes are `config/palettes.json`. Its enemy's id is `<id>~<part>=<palette>,...`.

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
| `animate:` `break:` `enter:` `exit:` `interact:` `event:` `locked:` `unlock:` | level reports it | event: while state is current |
| `spawn:<group>` `defeated:<group>` `arrive:<state>` | design reports it | event: while state is current |
| `case:<name>` | case is true | condition |
| `state:<name>` | state was entered | condition |

`until` holds once its trigger has ever held. Max 16 state moves per frame.

## Reports

`state:<name>` · `case:<name>` (becomes true) · `spawn:<group>` (first out) ·
`defeated:<group>` (all gone) · `arrive:<state>` (player in place) · `unlock:<name>` ·
`animate:<layer>` (a moving layer arrived). Once per run each.

## Drafts

No `version`: converted in memory, changes noted, v1 printed to the console.
`set-case` → `set`, `characters.player` → `player`, `characters.enemy` → spawn group
`<state>-enemies`, `"2 seconds"` → `2`, `"a, b"` → `"a/b"`, `events` → `next` on the
state before, a `pick` list → `pool`, `"Name:render([part.background(palette)])"` →
`{ "enemy", "render" }`.

## Check it

SANDBOX TEST status line: `design: N warnings`; console lists them with "did you
mean". **Show Hitboxes**: state box bottom-left. `node scripts/checkLevelDesignVocab.js`.

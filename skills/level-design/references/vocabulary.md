# Level design vocabulary

Every name the engine reads, and nothing else: written from `LEVEL_DESIGN_VOCAB`
(`js/level/level-design.js`) and `LEVEL_MAP_RULES` (`js/level/level-map.js`) by

```sh
node scripts/checkLevelDesign.js --vocabulary skills/level-design/references/vocabulary.md
```

Do not edit it by hand: `node scripts/checkLevelDesignVocab.js` fails while it is out
of date. A name that is not here is either planned (see `patterns.md`) or a typo.

## Layer names (the art)

Matched case-sensitively, with `-` or `_` after the prefix. Illustrator's `-<n>`
copies (`ENTER-building-2`) match their base name in a layer path.

| Layer | Kind |
| --- | --- |
| `ENTERABLE-<name>` | enterable |
| `RESTRICTED-<name>` | enterable, locked at first |
| `REQUIRE-<type>-<name>` | require |
| `ENTER-<type>` | door (hotspot) |
| `OBJECT-<name>` | object |
| `ANIMATE-<asset>` | animate |
| `BREAKABLE-<name>` | breakable |
| `EVENT-<name>` | event |
| `INVENTORY-<item>` | item |
| `DEPTH-<name>` | depth |
| `MISSING-<name>` | reserved: recognised, warned about, planned |
| `SWITCH-<name>` | reserved: recognised, warned about, planned |
| `USABLE-<name>` | reserved: recognised, warned about, planned |
| `negative-space` | hole |

`REQUIRE-<type>` types: `case`, `state`, `item`. `ENTER-<type>` types: `building`, `vehicle`, `exit`.

## Design file keys

| Object | Keys |
| --- | --- |
| the file | `$schema`, `version`, `start`, `groups`, `cases`, `restricted`, `look`, `states` |
| a state | `svg`, `set`, `cases`, `reset`, `player`, `spawn`, `animate-layers`, `characters`, `next` |
| a state's `player` | `spawn`, `after`, `animation`, `inventory`, `health` |
| a spawn (a state's `spawn` entry) | `group`, `type`, `count`, `pick`, `pool`, `order`, `from`, `animation`, `after`, `every`, `then`, `inherit` |
| a group under `groups` > `<type>` | `count`, `pick`, `pool`, `order`, `from`, `animation`, `after`, `every`, `then`, `inherit` |
| a `pool` entry written as an object | `enemy`, `render`, `count`, `re-render`, `name` |
| a `next` step | `on`, `when`, `to` |
| a `restricted` entry | `until`, `type` |
| a case that follows a condition | `condition` |
| an `animate-layers` move | `layer`, `position-x`, `position-y`, `type`, `duration`, `after` |
| a state's `characters` (reserved: planned) | `friendly`, `neutral` |

Also read: `timeout` as `every`.

## Values

| Key | Values |
| --- | --- |
| `svg` | `loads`, `layer-state-change`, `fade-out`, `none` |
| `player.spawn` | `left`, `right`, or a layer path |
| `player.animation`, a spawn's `animation` | `walk`, `idle` |
| `player.inventory` | `empty`, `inherit`, `store` |
| `player.health` | `full`, `inherit`, `store` |
| a spawn's `type`, a group's type | `enemy` |
| `pick` | `random`, `in-order` |
| `order` | `random`, `sequence`, `reverse`, `same`, `load`, or a list of pool entry names |
| `then` | `fight`, `flee` |
| `from` (besides a layer path) | `edges` |
| a `restricted` entry's `type` | `once`, `condition` |
| `reset` list kinds | `break`, `animate`, `unlock`, `case` (as `<kind>:<name>`) |
| `reset` (all of it) | `level` |
| an `animate-layers` move's `type` | `linear`, `ease-in`, `ease-out`, `ease-in-out` |

## Conditions

A case can follow a condition: `{ "condition": "<source>[:<name>] [<op> <whole number>]" }`.

| | |
| --- | --- |
| sources that count | `alive`, `fled`, `inventory` (no op: at least 1) |
| sources that are true or false | `case`, `state` |
| ops | `=`, `==`, `!=`, `<`, `<=`, `>`, `>=` |

## Triggers

What `on` and `until` name, as `<kind>:<key>`.

| Reported by | Kinds |
| --- | --- |
| the level map | `animate`, `break`, `enter`, `exit`, `interact`, `event`, `locked`, `unlock`, `lock` |
| the director | `spawn`, `defeated`, `fled`, `arrive` |
| the player | `take`, `use`, `drop`, `combine`, `look`, `talk` |
| conditions (true while they hold) | `case`, `state` |

Kinds whose key is an item in the catalog: `take`, `use`, `drop`, `combine`.

## Reports

What the director reports, for checklists: `state`, `case`, `spawn`, `defeated`, `fled`, `arrive`, `unlock`, `lock`.

Format version: `1`.

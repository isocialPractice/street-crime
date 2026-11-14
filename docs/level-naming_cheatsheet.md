# Level Naming Cheatsheet

For the reasons behind each rule, see [level-naming.md](level-naming.md).

## Export

Illustrator SVG export, **Object IDs: Layer Names**. Prefixes are upper case;
`-` or `_` after them. `-2`, `-3` copies keep their type.

## Scene

| id | Is |
| --- | --- |
| `field` | walkable area (rect, polygon, polyline) |
| `section_<n>` | one screen, in order from `section_1` |
| `border` | rect in a section: that screen's slice |
| `negative-space` | hole inside `field` |

## Map ids

| id | Inside | Does | Reports |
| --- | --- | --- | --- |
| `ENTERABLE-<name>` | any | enterable; interior `enterables/<name>.svg` or camelCase | `enter:` / `exit:<name>` |
| `RESTRICTED-<name>` | any | enterable, locked | `locked:` / `unlock:<name>` |
| `REQUIRE-case-<c>` | `RESTRICTED` | unlock when case is true | |
| `REQUIRE-state-<s>` | `RESTRICTED` | unlock once state entered | |
| `REQUIRE-item-<i>` | `RESTRICTED` | unlock while the player carries it | |
| `ENTER-building` | enterable | door to the interior | |
| `ENTER-exit` | interior | way back out (else: left edge) | |
| `OBJECT-<name>` | any | area; empty one: E reports | `interact:<name>` |
| `ANIMATE-<asset>` | `OBJECT` | frames `objects/<asset>_0.svg`... | `animate:<asset>` |
| `BREAKABLE-<name>` | `OBJECT` | cut out, breaks; `_damaged`, `_broken` art | `break:<name>` |
| `INVENTORY-<item>` | `OBJECT` | an item to take (E: CHECK); empty layer: the catalog's art | `take:<item>` |
| `EVENT-<name>` | any | trigger area | `event:<name>` |

**Planned:** `ENTER-vehicle`, `MISSING-`, `SWITCH-`, `USABLE-`. Items: [inventory.md](inventory.md).

## Files

| Put | In |
| --- | --- |
| level | `assets/levels/<level>/level-<level>.svg` |
| animation frames | `assets/levels/<level>/objects/<asset>_0.svg`, `_1`, ... (or `assets/objects/`) |
| breakable state art | `assets/levels/<level>/objects/<name>_damaged.svg`, `<name>_broken.svg` |
| interior | `assets/levels/<level>/enterables/<name>.svg` |
| level design | `config/levels/<level>/level-design.json` |

## Paths

`PARENT/CHILD`, by mapped parents: `RESTRICTED-storage-room/ENTER-building`.

## Doors

| | |
| --- | --- |
| use | E, or hold Up 0.25 s |
| reach | body over the door, feet within 16 px; runs down to ground below a raised door |
| fade | 0.35 s out, 0.35 s in |

## Check it

Debug mode, **Show Hitboxes**: every map id outlined. SANDBOX TEST: console table
plus warnings for typos and missing pieces.

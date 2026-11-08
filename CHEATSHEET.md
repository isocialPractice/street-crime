# Street Crime Cheatsheet

Every naming rule and config key on one page. Each section has a full page in
[docs/](docs/README.md).

## Level layers ([level-naming](docs/level-naming.md))

Illustrator SVG export, **Object IDs: Layer Names**. Upper-case prefixes, then `-`
or `_`. `-2` copies keep their type.

| id | Inside | Does | Reports |
| --- | --- | --- | --- |
| `field` | | walkable area | |
| `section_<n>`, `border` | | screens, in order | |
| `negative-space` | `field` | hole | |
| `ENTERABLE-<name>` | any | interior `enterables/<name>.svg` | `enter:`, `exit:<name>` |
| `RESTRICTED-<name>` | any | enterable, locked | `locked:`, `unlock:<name>` |
| `REQUIRE-case-<c>`, `REQUIRE-state-<s>` | `RESTRICTED` | unlock condition | |
| `ENTER-building`, `ENTER-exit` | enterable | door in, way out | |
| `OBJECT-<name>` | any | area; empty: E | `interact:<name>` |
| `ANIMATE-<asset>` | `OBJECT` | frames `objects/<asset>_0.svg`... | `animate:<asset>` |
| `BREAKABLE-<name>` | `OBJECT` | breaks; `_damaged`, `_broken` art | `break:<name>` |
| `EVENT-<name>` | any | trigger area | `event:<name>` |

**Planned:** `ENTER-vehicle`, `REQUIRE-item-`, `INVENTORY-`, `MISSING-`, `SWITCH-`, `USABLE-`.
Paths: `PARENT/CHILD`, such as `RESTRICTED-storage-room/ENTER-building`.

## Level design ([level-design](docs/level-design.md))

`config/levels/<level>/level-design.json`:
`{ "version": 1, "start", "cases", "restricted": { "<name>": { "until" } }, "states" }`

| State key | Value |
| --- | --- |
| `svg` | `loads`, `layer-state-change`, `fade-out` |
| `set` | `{ "<case>": true or false }` |
| `player` | `spawn` (`left`, `right`, path), `after`, `animation` (`walk`, `idle`), `health`, `inventory` (`full`/`empty`, `inherit`, `store`) |
| `spawn` | `[{ group, type: "enemy", from, count, pick (random, in-order), pool, animation, after, every }]` |
| `next` | `[{ "on": "<trigger>", "to": "<state>" }]` |

| Trigger | Is |
| --- | --- |
| `break:` `enter:` `exit:` `interact:` `animate:` `event:` `locked:` `unlock:` | level events |
| `spawn:<group>` `defeated:<group>` `arrive:<state>` | design events |
| `case:<name>`, `state:<name>` | conditions |

Reports: `state:`, `case:` (turns true), `spawn:`, `defeated:`, `arrive:`, `unlock:`.
No `version`: a draft, converted with notes.

## Characters ([character-assets](docs/character-assets.md))

`<Name>.svg` · `<Name>_<action>.svg` · `<Name>_<action>_<n>.svg` (from `_0`, no gaps).
Enemies in `config/enemy-assets.json`: `"<animation>": { "mode", "suffixes" }`.

| Mode | Plays |
| --- | --- |
| `hold` / `loop` / `sequence` / `yoyo` | one pose / cycles / once / 0 1 2 1 0 |

Suffix lookup: literal file, then another animation's frames, then `_0`, `_1`, ...
New enemy: art, config entry, `ENEMY_DEFS` line in `js/entities/enemy.js`.

## Objects ([object-assets](docs/object-assets.md))

| File | For |
| --- | --- |
| `assets/objects/Object_Box.svg`, `_Damaged`, `_Broken`, `Object_Health.svg` | crates and pickups |
| `assets/levels/<level>/objects/<asset>_0.svg`... | `ANIMATE-<asset>` |
| `assets/levels/<level>/objects/<name>_damaged.svg`, `_broken.svg` | `BREAKABLE-<name>`, artboard the size of the piece |

Playback: sandbox `levelMap.animate`: `{ "<asset>": { "mode": "loop" | "yoyo" | "hold", "fps": 6 } }`.

## Sandbox ([sandbox](docs/sandbox.md))

`config/debug/sandbox.json`: `{ "active", "tests": { "<key>": { level, scene,
design, spawn, cfg, levelMap, enterables, enemies, checklist } } }`. Read on every
RESTART. Console: map table and warnings. **Show Hitboxes**: outlines and the
design's state box.

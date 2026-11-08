# Object Assets Cheatsheet

For the reasons behind each rule, see [object-assets.md](object-assets.md).

## Shared (`assets/objects/`, listed in `js/sprites/objects.js`)

| File | Is |
| --- | --- |
| `Object_Box.svg`, `_Damaged`, `_Broken` | crate states |
| `Object_Health.svg` | health pickup |
| `Object_FadingImpact`, `_2`, `Object_HardImpact` | small, medium, hard hit |
| `Object_ImpactEffect`, `_2` | impact flashes |

Crate: `CFG.objBreakHits` 3, `CFG.objBreakDropChance` 0.65.

## Level (`assets/levels/<level>/objects/`)

| File | For |
| --- | --- |
| `<asset>_0.svg`, `_1`, ... | `ANIMATE-<asset>` frames, no gaps, up to 64 |
| `<asset>.svg` | single frame (static, warns) |
| `<name>_damaged.svg` | `BREAKABLE-<name>` after first hit |
| `<name>_broken.svg` | `BREAKABLE-<name>` once broken |

Lookup: level `objects/` first, then `assets/objects/`. `-2` layer copies share frames.

## Sizing

| Art | Artboard |
| --- | --- |
| animation frames | one artboard for all frames; padding free |
| breakable state art | the size of the piece |
| strokes | 6 units of room kept around a cut-out |
| text | outline it (Type > Create Outlines) |

## Playback (`levelMap.animate` in a sandbox test)

`{ "<asset>": { "mode": "loop" | "yoyo" | "hold", "fps": 6 } }`, then `default`,
then `CFG.levelAnimateMode` / `CFG.levelAnimateFPS`.

## Reports

`animate:<asset>` after a full cycle · `break:<name>` when broken.

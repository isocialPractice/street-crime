# Character Assets Cheatsheet

For the reasons behind each rule, see [character-assets.md](character-assets.md).

## Files

| File | Is |
| --- | --- |
| `<Name>.svg` | default pose |
| `<Name>_<action>.svg` | one pose |
| `<Name>_<action>_<n>.svg` | frame `n`, from `_0`, no gaps, up to 64 |

Folders: `assets/characters/player/`, `assets/characters/enemy/`. Sources:
`support/*.ai`. Case-sensitive.

## Enemy config (`config/enemy-assets.json`)

| Part | Is |
| --- | --- |
| `defaults` | animations every enemy has |
| `enemies.<Name>` | that character's own, over the defaults |
| `attackTypeDefaults` | extras per attack type (`weaponAttack`: get-up) |
| `wipEnemies` | art in progress: defaults only |

`"<animation>": { "mode": "...", "suffixes": ["", "walk_1", ...], "fallbackState": "idle" }`

## Animations

`idle` · `walk` · `attack` · `powerAttack` · `damage` · `preDefeat` · `defeat` ·
`taunt` · `block` · `blockResist` · `getUp`

## Modes

| Mode | Plays |
| --- | --- |
| `hold` | one pose |
| `loop` | cycles |
| `sequence` | once, holds last |
| `yoyo` | 0 1 2 1 0 1 2 ... |

## Suffix lookup

1. `<Name>_<suffix>.svg`
2. another animation of the same name: all its frames
3. `<Name>_<suffix>_0.svg`, `_1`, ...

## New enemy

Art in `assets/characters/enemy/` → entry in `enemy-assets.json` → `ENEMY_DEFS`
line in `js/entities/enemy.js` (`img: "<Name>"`) → a wave or a spawn group pool.

## Player

Frames listed in `js/sprites/player.js`. Enemy-applied reactions:
`"apply<State>": "<Variant>"` → `Player_<State>_<Variant>.svg` or `_0`, `_1`, ...

## Layer names

frame `walk_0` › part `front-glove` › tone `glove-light` / `-mid` / `-dark` / `outline`.
Bulk rename: `scripts/mapLayers.jsx`. Scheme and recoloring: **planned**.

# Street Crime Documentation

How the game's art and configuration fit together: how a level is built from the
names of its Illustrator layers, how a level design file makes things happen in
it, and how characters and objects are named so the game can find them.

[Play the demo](https://isocialpractice.github.io/street-crime/).

## Start here

| | |
| --- | --- |
| [QUICKSTART.md](../QUICKSTART.md) | Play the demo, try a level in SANDBOX TEST, and make a first level |
| [CHEATSHEET.md](../CHEATSHEET.md) | Every naming rule and config key on one page |

## Levels

| Page | |
| --- | --- |
| [level-naming.md](level-naming.md) | What a level SVG says through its layer names: the walkable field, doors, locks, animated and breakable scenery, trigger areas, holes. Also as a [quickstart](level-naming_quickstart.md) and a [cheatsheet](level-naming_cheatsheet.md) |
| [level-design.md](level-design.md) | When things happen: states, cases, triggers, spawn groups, player entrances and drafts in `level-design.json`. Also as a [quickstart](level-design_quickstart.md) and a [cheatsheet](level-design_cheatsheet.md) |

## Assets

| Page | |
| --- | --- |
| [character-assets.md](character-assets.md) | File names, enemy animation config, the player's frames, and layer names inside a character. Also as a [quickstart](character-assets_quickstart.md) and a [cheatsheet](character-assets_cheatsheet.md) |
| [object-assets.md](object-assets.md) | Shared objects, and a level's animation frames and breakable state art. Also as a [quickstart](object-assets_quickstart.md) and a [cheatsheet](object-assets_cheatsheet.md) |

## Testing

| Page | |
| --- | --- |
| [sandbox.md](sandbox.md) | SANDBOX TEST: the config file, the panel, reading its output, and the level design steps |

## Elsewhere in the repository

| | |
| --- | --- |
| `scripts/README.md` | The Illustrator scripts: running them from a terminal, and renaming layers from a layer map |
| `config/schema/level-design.schema.json` | The level design format, for editors |
| `config/palettes.json`, `config/schema/palettes.schema.json` | The palettes a level design can recolor a character's parts with |

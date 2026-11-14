# Street Crime Quickstart

## Play

Open the [demo](https://isocialpractice.github.io/street-crime/) and press Enter.
Move with the arrow keys or WASD, punch with J, kick with K, jump with Space, run
with Shift, block with C, and use doors and take items with E. I or Tab opens your
items; Ctrl+I opens a command line for LOOK, TALK and USE ([inventory](docs/inventory.md)).

## Run it locally

The game is plain HTML and JavaScript with no build step, but it reads its config
and art files over HTTP, so serve the folder rather than opening the file:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Try a level in SANDBOX TEST

Pick **SANDBOX TEST** on the title screen. It loads `theStreets` with its level
design: walk in, break the parking gate, beat the three enemies who come out of the
warehouse, and go inside. The checklist on the left ticks as each part happens.
**Show Hitboxes** outlines every named layer.

Tests are set up in `config/debug/sandbox.json`; see [docs/sandbox.md](docs/sandbox.md).

## Make a first level

1. Draw it in Illustrator with named layers (`field`, `ENTERABLE-corner-shop`,
   `BREAKABLE-crate-stack`, ...), and export SVG with **Object IDs: Layer Names**:
   [docs/level-naming_quickstart.md](docs/level-naming_quickstart.md)
2. Make something happen in it with a `level-design.json`:
   [docs/level-design_quickstart.md](docs/level-design_quickstart.md)
3. Add animated and breakable art:
   [docs/object-assets_quickstart.md](docs/object-assets_quickstart.md)
4. Give a character a new animation:
   [docs/character-assets_quickstart.md](docs/character-assets_quickstart.md)

## Where things are

| Path | Holds |
| --- | --- |
| `assets/levels/<level>/` | a level's SVG, its `objects/` and `enterables/` |
| `assets/characters/` | player and enemy art |
| `assets/objects/` | crates, pickups, hit effects |
| `config/levels/<level>/level-design.json` | when things happen in a level |
| `config/enemy-assets.json` | how enemy art is animated |
| `config/debug/sandbox.json` | SANDBOX TEST setups |
| `docs/` | the documentation ([index](docs/README.md)) |

Every rule on one page: [CHEATSHEET.md](CHEATSHEET.md).

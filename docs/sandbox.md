# Sandbox Test

SANDBOX TEST is the title menu entry for trying one feature at a time: one level,
one player, the debug panels, and a checklist that ticks as the feature reports
in. What it loads is written in `config/debug/sandbox.json`, not in code, so a new
test is a new entry in that file.

## The file

```json
{
  "active": "back-alley",
  "tests": {
    "back-alley": {
      "label": "Back alley",
      "level": "assets/levels/back-alley/",
      "scene": "level-back-alley.svg",
      "design": "config/levels/back-alley/level-design.json",
      "checklist": [
        { "label": "Break the crates", "event": "break:crate-stack" }
      ]
    }
  }
}
```

`"active"` is the test the menu starts. Each entry under `"tests"` takes:

| Key | Default | Is |
| --- | --- | --- |
| `label` | the test's key | shown in the panel |
| `level` | required | the level folder |
| `scene` | required | the level SVG in that folder |
| `design` | none | a level design file ([level-design.md](level-design.md)) |
| `sectionWidth` | 800 | width of one screen, in world px |
| `worldHeight` | 600 | height of the level, in world px |
| `spawn` | `{ "minX": 60, "maxX": 220 }` | where the player starts, and where `"spawn": "left"` walks them to |
| `panels` | `{ "debug": true, "checklist": true }` | which debug panels to show |
| `cfg` | `{}` | game settings to override, such as `{ "showHitboxes": true }` |
| `levelMap` | `{ "enabled": true, "animate": {} }` | read the level's map ids, and how its animations play ([object-assets.md](object-assets.md#animation-frames)) |
| `enterables` | `{}` | an interior for an enterable whose file is not named after it: `{ "bad-bar": "enterables/badBar.svg" }` |
| `enemies` | `[]` | enemy ids to spawn near the player at the start |
| `checklist` | `[]` | `{ "label", "event" }` rows, ticked when the event is reported |

A key left out takes its default. An object merges with its default one level
deep, so `"spawn": { "minX": 300 }` keeps the default `maxX`.

The file is read again on every start and on RESTART, so a test can be changed
and rerun without reloading the page. If the file cannot be read, or a test is
missing its `level` or `scene`, the sandbox runs a built-in test of
`assets/levels/theStreets/` and says why on its status line.

## The panel

| Part | Does |
| --- | --- |
| test list | picks another test from the file |
| RESTART | starts the picked test again from the beginning |
| status line | `ready`, how many map ids and warnings the level has, and `design: N warnings`; red when something is wrong |
| checklist | each row ticks when its event is reported |

Checklist events are anything the level or its design reports: `break:`,
`enter:`, `state:`, `spawn:`, `defeated:`, `arrive:` and the rest (see
[level-naming.md](level-naming.md#events-a-level-reports) and
[level-design.md](level-design.md#reports)).

## Reading what it says

- **The console table.** On start, every map id in the level is printed with its
  kind, its parent and where it landed in the world. The quickest way to check a
  layer named in Illustrator against where the game placed it.
- **Warnings.** Map warnings (`[level-map]`) and design warnings (`[level-design]`)
  are printed one per line, each saying what will not work and, for a name, the
  closest real one.
- **A draft design** is converted, and the console prints it as version 1, ready to
  save.
- **Show Hitboxes.** Outlines every map id with its name, and shows the level
  design's state box in the bottom-left corner: the current state, the cases, what
  is locked, spawn groups, the player's entrance and what was stored.

## The level design steps

`config/debug/sandbox.json` holds the tests the level design features were built
with, one feature at a time on `theStreets`. Each step's own design file is in
`config/debug/designs/`.

| Test | Tries |
| --- | --- |
| `level-mapping` | the level map alone: an animated sign, a breakable gate, a bar to go into |
| `design-1-restricted` | a locked warehouse door, from the SVG alone |
| `design-2-states` | states and cases; the gate unlocks the warehouse |
| `design-3-spawn` | three enemies walk out of the warehouse door |
| `design-4-defeat` | beating them fades the screen, the player walks back in, the warehouse opens |
| `design-5-drafts` | the original draft file, converted |
| `design-7-render` | a gold JumpingJunkie, then one with his vest recolored gray, from a pool entry with a `render` |
| `level-design` | the real `config/levels/theStreets/level-design.json`, end to end |

## On the published site

The demo on GitHub Pages runs the same sandbox. Debug mode's export buttons
download the tuned `configuration.json`, `enemies.json` and `objects.json`, there
as anywhere: nothing on the site changes. Copy a downloaded file into `config/` in
the repository to keep it.

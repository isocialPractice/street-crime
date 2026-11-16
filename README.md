<div align="center">
  <img src="logo.svg" alt="Street Crime" width="480"/>
  <br/><br/>

  **[▶ Play now on GitHub Pages](https://isocialpractice.github.io/street-crime/)**

  `Ctrl + click` to view [street-crime documentation](https://isocialpractice.github.io/street-crime/docs/index.html)

</div>

---

> Very much a work-in-progress, but still - this has been a fun project.

A classic 2.5D side-scrolling beat-em-up built entirely in vanilla HTML5 Canvas with no frameworks or dependencies. Take to the streets and fight through waves of criminals to reach the boss.

## Controls

| Action | Keys |
|---|---|
| Move | Arrow keys or WASD |
| Run | Hold Shift + direction |
| Punch | J or Z |
| Kick | K or X |
| Uppercut | J/Z + Up |
| Running Kick | K/X while running |
| Jump | Space |
| Block | Hold C |
| Jump Attack | J/Z or K/X while airborne |
| Enter a door / interact | E, or push into the door (hold Up) |
| Take an item | E at it, then YES |
| Items (use, check, combine) | I or Tab |
| Command line (look, talk, use, take) | Ctrl+I |
| Pause menu | P or Esc (P resumes; Esc steps back, or resumes); switching to another window pauses too |

## Features

- 2.5D beat-em-up movement and combat
- Combo system with multiplier display
- Input buffering — attack and jump presses made mid-animation fire the moment the player is free
- Enemy AI with flanking, queued rushing, and attack cooldowns
- Static enemy attacks — flanking enemies swing opportunistically when the player walks into range
- Pause-safe enemy strikes resolved in game time against live positions
- Animated background ambience — neon flicker and streetlight pulses (Stage 1), blinking warning lights and drifting water shimmer (Stage 2), flame flicker and rising embers (Stage 3)
- Unique per-character attack sprites (punch, kick) with frame-hold timing
- Enemy separation — characters spread to strategic positions rather than stacking
- Boss and sub-boss encounters with dedicated health bars
- Breakable objects that drop health pickups
- Data-driven enemy asset animation configuration
- Difficulty setting (Easy / Normal / Hard) on the title screen's Settings list, kept between visits
- Local Weather (off by default; the debug panel's **Local Weather** box, or `"weather": true` in `config/configuration.json`): the weather where the player is, from api.weather.gov
- Debug mode with live tuning sliders and sandbox spawning
- Debug Level mode that loads an SVG scene, uses its `#field` shape for walkable bounds, and steps through ordered `section_*` scene panels
- Debug Render, a page that shows every frame a level design recolors, as drawn beside recolored (`config/debug/renders.html`)
- Level map: doors into buildings, breakable scenery, animated signs and no-go areas, all set up by how layers are named in the level SVG (see [Level Map Ids](#level-map-ids))
- Sandbox Test mode for trying one feature at a time, configured from `config/debug/sandbox.json`, with a checklist that ticks as each feature reports in

## Tech

Pure vanilla JavaScript — no build step, no bundler, no dependencies. Open `index.html` in a browser and play.

Enemy asset wiring now lives in `config/enemy-assets.json`, while gameplay tuning remains in `config/enemies.json`.

Tuning lives in three files, `config/configuration.json`, `config/enemies.json` and `config/objects.json`, laid over the built-in values in `js/core/config.js` at startup, in that order. Debug mode's export buttons write those files. `config/defaults/` holds the same three files as the game ships them, and is what debug mode's **Reset to Defaults** buttons go back to: **Reset All to Defaults** in the right panel puts back every value, and each Debug Focus mode has its own button for just its sliders. Both ask for a second click. Exports never write to `config/defaults/`, so to make your current tuning the new default, export it and copy the file in.

The title screen lists `GAME`, `SETTINGS`, `DEBUG MODES` and `SANDBOX TEST`. `SETTINGS` holds `DIFFICULTY` (`EASY`, `NORMAL`, `HARD`, scaling enemy health and damage; Left and Right change it), kept in the browser between visits; a `GAME` started after a change plays at it, and the debug modes and `SANDBOX TEST` always play at `NORMAL`. `DEBUG MODES` opens a second list, `DEBUG MODE`, `DEBUG LEVEL`, `DEBUG RENDER` and `BACK` (Escape goes back too); `DEBUG RENDER` opens the render view, `config/debug/renders.html`. Pausing opens the same entries over the run, with `RESUME` first and `EXIT` last: `EXIT` goes back to the title screen at the entry the mode was started from (a debug mode to the `DEBUG MODES` list), `SETTINGS` opens over the paused run, and the other entries leave the run and start that mode. In `GAME`, leaving the run asks `QUIT THIS GAME?` first. Leaving a run puts the tuning back to what `config/` gave at startup, so a sandbox test's `cfg` and the debug sliders do not carry into the next mode. The render view pauses the same way, with the same entries; as it is a page of its own, `EXIT` goes back to the `DEBUG MODES` list with `DEBUG RENDER` highlighted, and the entries that start a mode open the game and start it there (`index.html?start=<mode>`). The `DEBUG LEVEL` entry loads `assets/levels/Test_ItWorked.svg`. The scene image is drawn from ordered `section_[0-9]+` groups, starting on `section_1`, so the player can scroll through the SVG one screen at a time. If a section contains a `border` rect, that rect defines the screen slice; otherwise the slice is derived from the section's child geometry. A level with no `section_*` groups takes its screens from its `border` rects instead, ordered left to right. Any SVG shape with `id="field"` remains the authoritative gameplay area for movement, and the same field geometry is used for debug object and enemy spawn sampling.

Local Weather draws sky, clouds, rain and a color grade over every stage (`js/rendering/weather.js`, from the `weather*` keys in `CFG`). While it is on, `js/core/local-weather.js` asks the browser for the player's location (the browser asks the player first), then api.weather.gov for that point's hourly forecast, and sets day or night, the tone (cold below 45°F, hot above 80°F) and the sky (stormy, cloudy or sunny) from the hour in progress; it asks again hourly. The location goes to weather.gov only. weather.gov covers the US only, so anywhere else, or with the location refused or no network, the stormy night `config/` gives stays. `assets/levels/weather/sun.svg` and `snow.svg` are optional: with them, a day sky shows the sun and cold weather falls as snow.

The `SANDBOX TEST` entry runs a test from `config/debug/sandbox.json`. Each entry under `"tests"` names a level folder and scene, where the player spawns, any `CFG` values to override, enemies to spawn, and a checklist of events to wait for; `"active"` picks the one the menu starts, and the panel can restart into any other. Adding a test for a new feature means adding an entry there, not changing code. If the file cannot be read, the sandbox runs a built-in test of `assets/levels/theStreets/` and says why on its status line. See [docs/sandbox.md](docs/sandbox.md).

```
assets.js   — SVG sprite loader, all image assets
game.js     — game engine, entities, AI, level manager, HUD
style.css   — layout and UI styling
index.html  — canvas and DOM shell
```

## [Level Map Ids](docs/level-naming.md)

A level SVG can describe more than its look. The id a layer exports with tells the engine what that part of the level does, so a door, a locked warehouse, a breakable gate or an animated sign is added in Illustrator by naming the layer:

| id | What it does |
|---|---|
| `ENTERABLE-<name>`, `RESTRICTED-<name>` | Something that can be entered, or entered once unlocked, through an `ENTER-<type>` door inside it |
| `OBJECT-<name>` | An area to interact with, holding `ANIMATE-<asset-name>` or `BREAKABLE-<name>` scenery |
| `EVENT-<name>` | A trigger area the player walks into |
| `negative-space` | A hole in `#field` that nobody can walk into |

When things happen (the gate breaks, enemies come out of a door) is written in `config/levels/<level>/level-design.json`: see [docs/level-design.md](docs/level-design.md). The full layer rules are in [docs/level-naming.md](docs/level-naming.md), also as a [quickstart](docs/level-naming_quickstart.md) and a [cheatsheet](docs/level-naming_cheatsheet.md). Or describe a level in plain words and let the `level-design` agent skill write the design for Claude Code, Copilot or Codex: [docs/level-design-skill.md](docs/level-design-skill.md).

## Asset Sources and Scripts

Character, enemy and object art is drawn in Adobe Illustrator and exported as one SVG per frame, under `assets/characters/player/`, `assets/characters/enemy/`, `assets/objects/` and `assets/levels/`. Keep the source `.ai` files in `support/`. That folder is git-ignored because source files for detailed game art get large. The two files committed there, `source-player.ai` and `source-enemies.ai`, are examples for trying the scripts.

`scripts/` holds the command-line tooling for those sources. `mapLayers.jsx` renames layers and paths from a JSON layer map, so exported SVGs carry ids the game can use for color and outfit changes. `mapSelectLayers.jsx` selects what that map points at, so you can check it in Illustrator first. `renameSelectedLayers.jsx` renames whatever is selected from one pattern, for quick renaming by hand. `runAdobeScript.pl` runs any Illustrator script from a terminal on Windows or macOS:

```sh
perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai dry=1
```

See [scripts/README.md](scripts/README.md) for options and the layer map format.

## License

See [LICENSE](LICENSE).

<div align="center">
  <img src="logo.svg" alt="Street Crime" width="480"/>
  <br/><br/>

  **[▶ Play now on GitHub Pages](https://isocialpractice.github.io/street-crime/)**

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
| Jump Attack | J/Z or K/X while airborne |
| Pause | P |

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
- Debug mode with live tuning sliders and sandbox spawning
- Debug Level mode that loads an SVG scene, uses its `#field` shape for walkable bounds, and steps through ordered `section_*` scene panels

## Tech

Pure vanilla JavaScript — no build step, no bundler, no dependencies. Open `index.html` in a browser and play.

Enemy asset wiring now lives in `config/enemy-assets.json`, while gameplay tuning remains in `config/enemies.json`.

The title screen now includes a `DEBUG LEVEL` entry that loads `levels/Test_ItWorked.svg`. The scene image is drawn from ordered `section_[0-9]+` groups, starting on `section_1`, so the player can scroll through the SVG one screen at a time. If a section contains a `border` rect, that rect defines the screen slice; otherwise the slice is derived from the section's child geometry. Any SVG shape with `id="field"` remains the authoritative gameplay area for movement, and the same field geometry is used for debug object and enemy spawn sampling.

```
assets.js   — SVG sprite loader, all image assets
game.js     — game engine, entities, AI, level manager, HUD
style.css   — layout and UI styling
index.html  — canvas and DOM shell
```

## License

See [LICENSE](LICENSE).

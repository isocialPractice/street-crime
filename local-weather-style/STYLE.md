# Local Weather Style Contract

This file is the styling contract the `weather-server` GUI tools read on every
call. It records what this application is, how it is built, how it is currently
styled, and exactly which knobs to turn for a given
`temperature` / `precipitation` / `current_time` triple.

Read this file before making any style change. Do not re-derive the
architecture from scratch each time.

## 1. Application architecture

Street Crime is a browser side-scrolling beat-em-up. It is a static site with
no build step, no bundler, and no package manager. Every script is a plain
global-scope file loaded by an ordered list of `<script>` tags in
`index.html`. Load order is the dependency graph, so a new file must be
inserted at the correct position, not appended.

| Layer | Path | Role |
| --- | --- | --- |
| Entry page | `index.html` | Script load order, HUD markup, title screen |
| Page styling | `style.css` | All DOM chrome: title screen, HUD, overlays, debug panels |
| Sprite loading | `js/sprites/loader.js` | `loadSvgFile(path)`, `loadSvgImg(svgString)` |
| Decode gate | `js/sprites/ready.js` | `ASSETS_READY` promise awaited before the first frame |
| Stage art | `js/sprites/backgrounds.js` | `BACKGROUNDS[]`, three inline SVG scenes, 1600x600 each |
| Tunables | `js/core/config.js` | `CFG` object, the only place gameplay and render constants live |
| Canvas refs | `js/core/canvas.js` | `ctx`, `W`, `H` |
| Camera | `js/core/camera.js` | `cam.x`, `cam.shakeX`, `cam.shakeY` |
| Background draw | `js/rendering/background.js` | `drawStageBackground()`, parallax tiling, animated ambience |
| Scene draw | `js/rendering/draw.js` | `draw()`, depth sort, overlays, `drawDebug()` |
| Debug panel | `js/ui/debug.js` | Checkbox and slider bindings over `CFG` |

Key invariants to respect:

- The canvas is 800x600. Background tiles are 1600x600 and are drawn twice
  side by side, offset by `cam.x * 0.45`, to fake an infinite scroll.
- The walkable ground zone is `y = 390` to `y = 510`. Everything above 390 is
  scenery the player never touches, so sky-side weather is free to use it.
- `CFG` is the single source of truth for anything tunable. Never hardcode a
  render constant that a future call might want to change.
- Sprites must be loaded through `loadSvgFile()`. A raw `img.src = "file.svg"`
  draws blank on a canvas in most browsers, which is why the loader wraps the
  markup in a Blob URL and registers a decode promise.
- Because loading uses a synchronous `XMLHttpRequest`, the page must be served
  over HTTP. Opening `index.html` from the filesystem yields empty sprites.

## 2. Current styling baseline

### Canvas art

Three stage scenes exist in `BACKGROUNDS`, indexed by `STAGES[n].bgIdx`:

| Index | Stage | Palette |
| --- | --- | --- |
| 0 | The Streets | Noir navy sky `#04091a` to `#111d34`, warm lit windows, neon red and cyan |
| 1 | The Docks | Cold blue sky `#040e18` to `#0a1e2e`, steel and water, orange warning lamps |
| 2 | The Hideout | Rust red sky `#150208` to `#280a10`, industrial pipes, flaming barrels |

All three are already night scenes. Stages 0 and 1 have a moon baked into the
SVG at tile-local coordinates; stage 2 has none.

| Index | Baked moon center | Radius |
| --- | --- | --- |
| 0 | `1460, 62` | 26 |
| 1 | `1350, 55` | 22 |
| 2 | none | n/a |

`drawBgAmbience()` in `js/rendering/background.js` animates details on top of
the static tiles using tile-local coordinates copied from
`js/sprites/backgrounds.js`. Any new overlay should follow the same
convention: copy the coordinate from the scene, do not guess it.

### DOM chrome

`style.css` is a single flat stylesheet with no custom properties in its
original form. The accent color `#ffd700` (gold) is repeated in roughly
twenty places: title heading, buttons, score, overlays, pause text, and every
debug control.

To make weather restyling cheap, the stylesheet now declares a palette block
of custom properties on `:root`. Restyle by editing those tokens, not by
hunting hex literals:

| Token | Meaning |
| --- | --- |
| `--wx-accent` | Primary accent, formerly `#ffd700` |
| `--wx-accent-soft` | Accent used for glow and low-emphasis text |
| `--wx-page-bg` | Page background behind the game frame |
| `--wx-frame` | Game container border |
| `--wx-frame-glow` | Game container box shadow color |
| `--wx-panel-bg` | Debug and overlay panel fill |
| `--wx-text` | Default light text |
| `--wx-text-dim` | Secondary label text |

## 3. Weather layer

The weather layer is additive. It never edits the stage SVGs, so removing it
is a matter of turning `CFG.weather` off.

| Path | Role |
| --- | --- |
| `assets/weather/cloud.svg` | Cloud body, copied from the weather server assets |
| `assets/weather/rain.svg` | Single raindrop, copied from the weather server assets |
| `assets/weather/moon.svg` | Moon disc, copied from the weather server assets |
| `assets/weather/sun.svg` | Sun disc, copy from the server when a day render is requested |
| `assets/weather/snow.svg` | Snowflake, copy from the server when a cold render is requested |
| `js/sprites/weather.js` | Loads the weather SVGs into `WEATHER_SPRITES` |
| `js/rendering/weather.js` | `drawWeatherSky()` and `drawWeatherFront()` |

`js/sprites/weather.js` loads after `loader.js` and before `ready.js`, so the
decode gate covers it. `js/rendering/weather.js` loads after
`background.js` and before `draw.js`.

`draw()` calls the two weather passes around the entity depth sort:

- `drawWeatherSky(bgIdx)` runs immediately after `drawStageBackground()`, so
  the moon, clouds, and sky tone sit behind characters.
- `drawWeatherFront()` runs after entities, pickups, and effects, so rain,
  lightning, and the heat haze fall in front of them.

Both passes are driven by `performance.now()` rather than the frame delta, so
weather keeps animating while the game is paused, matching the behavior of
`drawBgAmbience()`.

## 4. How to apply a render

The server returns four values. Map them as follows.

### `Render Background: day | night`

| Value | Action |
| --- | --- |
| `night` | `CFG.weatherNight = true`. Draw `moon.svg`. Keep the stage sky as authored. |
| `day` | `CFG.weatherNight = false`. Draw `sun.svg` in the moon slot. Raise `CFG.weatherSkyLift` to roughly `0.35` so the authored night sky washes toward daylight. |

The moon or sun is drawn at `WEATHER_SKY_BODY[bgIdx]`, in tile-local
coordinates at the same `0.45` parallax as the background, so on stages 0 and
1 it lands exactly on the baked disc instead of duplicating it.

### `Render Tone: hot | medium | cold`

Tone is a full-canvas color grade plus a ground-level haze.

| Value | `CFG.weatherTone` | Grade color | Haze |
| --- | --- | --- | --- |
| `hot` | `'hot'` | Amber `255, 110, 30` at about `0.10` alpha | Heat shimmer band above the ground line |
| `medium` | `'medium'` | No grade | None |
| `cold` | `'cold'` | Steel blue `120, 180, 255` at about `0.10` alpha | Low frost mist along the ground line |

### `Precipitation Use: Set per stormy | cloudy | sunny`

| Value | Clouds | Rain | Lightning |
| --- | --- | --- | --- |
| `stormy` | `cloud.svg`, dark tint, dense | Yes, heavy, wind-slanted | Yes |
| `cloudy` | `cloud.svg`, light tint, sparse | No | No |
| `sunny` | None. Wash the sky blue instead. | No | No |

When precipitation is `stormy` or `cloudy` and the tone is `cold`, the falling
sprite is `snow.svg` instead of `rain.svg`, and `CFG.weatherWind` should drop
to roughly `0.12` so flakes drift rather than streak.

### `current_time`

The server has already converted the clock to `day` or `night`. Do not parse
the time again here. Day runs from 08:00 to 20:00.

## 5. Weather configuration keys

All weather keys live in `CFG` in `js/core/config.js`, in the
`Local weather` block. Every one is safe to toggle at runtime.

| Key | Type | Meaning |
| --- | --- | --- |
| `weather` | boolean | Master switch for both weather passes |
| `weatherNight` | boolean | Night render, controls moon vs sun |
| `weatherTone` | string | `hot`, `medium`, or `cold` |
| `weatherPrecip` | string | `stormy`, `cloudy`, or `sunny` |
| `weatherClouds` | boolean | Cloud layer on or off |
| `weatherCloudCount` | number | Clouds per drifting layer |
| `weatherRainCount` | number | Simultaneous falling drops |
| `weatherRainSpeed` | number | Fall speed in pixels per second |
| `weatherWind` | number | Horizontal drift as a fraction of fall speed |
| `weatherLightning` | boolean | Lightning flashes on or off |
| `weatherToneAlpha` | number | Strength of the temperature color grade |
| `weatherSkyLift` | number | Daylight wash applied over a night sky |

`js/ui/debug.js` exposes a `WEATHER` section so these can be tuned live and
exported through the existing `configuration.json` export button.

## 6. Git workflow

The server directs all styling onto a dedicated branch. Do not commit weather
styling to `main`.

```bash
git checkout local-weather 2>/dev/null || git checkout -b local-weather
```

Then apply the mapping in section 4, and serve the app from the repository
root, for example:

```bash
python -m http.server 8000
```

## 7. Change log

| Render | Background | Tone | Precipitation | Result |
| --- | --- | --- | --- | --- |
| First | night | hot | stormy | Weather layer added, palette tokens introduced, storm clouds, wind-driven rain, lightning, amber heat grade |

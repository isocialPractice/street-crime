# Object Assets

Objects are the things in a level that are not characters: crates and the health
they drop, hit effects, and the pieces of level art that animate or break. They
come in two kinds:

- **Shared objects** in `assets/objects/`, used by every stage.
- **Level objects** in `assets/levels/<level>/objects/`, belonging to one level's
  `ANIMATE-` and `BREAKABLE-` layers.

Also as a [quickstart](object-assets_quickstart.md) and a [cheatsheet](object-assets_cheatsheet.md).

## Shared objects

These are listed by name in `js/sprites/objects.js`:

| File | Is |
| --- | --- |
| `Object_Box.svg` | a crate, untouched |
| `Object_Box_Damaged.svg` | the crate after its first hit |
| `Object_Box_Broken.svg` | the crate once broken |
| `Object_Health.svg` | the health pickup a broken crate can drop |
| `Object_FadingImpact.svg` | small hit effect (punches) |
| `Object_FadingImpact_2.svg` | medium hit effect (kicks) |
| `Object_HardImpact.svg` | hard hit effect (uppercuts, specials, breaking) |
| `Object_ImpactEffect.svg`, `Object_ImpactEffect_2.svg` | impact flashes |

A crate takes `CFG.objBreakHits` blows (3 by default) and drops health with
`CFG.objBreakDropChance` (65%). New kinds of breakable object (trash cans,
barrels) and weapon pickups are **planned**; today a new shared object needs a line
in `js/sprites/objects.js`.

`assets/objects/` is also a place for frame runs any level can use: an
`ANIMATE-wheel-assembly` layer in any level finds `assets/objects/wheel-assembly_0.svg`
to `_4.svg` when its own level folder has none.

## Level objects

```text
assets/levels/<level>/objects/
  <asset>_0.svg, <asset>_1.svg, ...     frames for ANIMATE-<asset>
  <name>_damaged.svg                    hit state for BREAKABLE-<name>
  <name>_broken.svg                     broken state for BREAKABLE-<name>
```

In `theStreets`: `objects/sign-badBar_0.svg` to `_2.svg` animate the BAD BAR sign.

The level's layers decide what uses these files; see
[level-naming.md](level-naming.md#animate-frame-animation).

### Animation frames

| Rule | Why |
| --- | --- |
| Frames are `<asset>_0.svg`, `_1`, ... with no gaps | the run stops at the first missing number, up to 64 |
| One artboard, exported once per frame | every frame is drawn the way frame 0 measures |
| The artboard can have its own padding | frame 0's artwork is lined up with the layer's artwork, scaled by width |
| A single `<asset>.svg` works too | it is drawn live but does not animate, with a warning |
| The level's `objects/` is looked in before `assets/objects/` | a level can override a shared run |

Text in a frame is measured in the browser. If the font is not available there, a
wider fallback font is used and the frame's view is widened so nothing is cut off,
but the text will not look as drawn. Outlining text in Illustrator
(**Type > Create Outlines**) avoids it.

**How a level plays its animations** is set in the sandbox test's `levelMap.animate`:

```json
"levelMap": {
  "enabled": true,
  "animate": {
    "default":    { "mode": "loop", "fps": 6 },
    "neon-sign":  { "mode": "yoyo", "fps": 4 }
  }
}
```

The piece's asset name is looked up first, then `default`, then the game's
`CFG.levelAnimateMode` and `CFG.levelAnimateFPS`. Modes are `loop`, `yoyo` (out and
back without repeating either end) and `hold` (frame 0 only).

### Breakable state art

A `BREAKABLE-<name>` layer is cut out of the level's own art, so it needs no file
at all. State art is optional:

| File | Shown | Without it |
| --- | --- | --- |
| `<name>_damaged.svg` | after the first hit | the piece shakes as itself |
| `<name>_broken.svg` | once broken | the piece is gone |

Export state art on an artboard the size of the piece it replaces, the way the
crate's three sprites share one size. The cut-out keeps 6 units of room around the
piece for strokes, since Illustrator's measurements leave strokes out.

The splinters a piece breaks into take up to eight of its own fill colors.
Gradient fills are skipped, and black is used only when a piece has nothing else.

Note the case: level state art is `_damaged` and `_broken` in lower case, while the
shared crate is `Object_Box_Damaged`. File names are case-sensitive on the site
that serves the game.

## Planned

- new breakable object types, each with damaged and broken art
- weapon pickups and throwable objects
- `INVENTORY-`, `MISSING-`, `SWITCH-` and `USABLE-` objects in a level
  ([level-naming.md](level-naming.md#map-ids))
- layer names inside object art for recoloring, as for characters
  ([character-assets.md](character-assets.md#layer-names-inside-a-character))

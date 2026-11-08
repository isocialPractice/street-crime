# Level Naming Quickstart

Build a one-screen level with a walkable street, a door into a shop, a crate stack
that breaks, and a trigger area, then try it in SANDBOX TEST. About 15 minutes.
The full rules are in [level-naming.md](level-naming.md).

## 1. Make the folders

```text
assets/levels/back-alley/
  objects/
  enterables/
```

## 2. Draw the level in Illustrator

One artboard, 800 by 600 or wider. Name the layers exactly as shown: the names are
what the game reads.

```text
field                          a polygon over the ground people can walk on
ENTERABLE-corner-shop          a group: the shop front artwork...
  ENTER-building               ...with the door as its own group inside it
OBJECT-crate-stack             a group: the crates' area...
  BREAKABLE-crate-stack        ...with the crates as their own group inside it
EVENT-alley-ambush             a rect on the ground, further along
```

Everything else can be named however you like.

## 3. Export

**File > Export > Export As...**, SVG, and set **Object IDs** to **Layer Names**.
Save it as `assets/levels/back-alley/level-back-alley.svg`.

## 4. Give the shop an interior

Save any small level SVG (with its own `field`) as
`assets/levels/back-alley/enterables/corner-shop.svg`. Walking into its left edge
leads back out.

## 5. Add a sandbox test

In `config/debug/sandbox.json`, add an entry under `"tests"` and point `"active"`
at it:

```json
"back-alley": {
  "label": "Back alley",
  "level": "assets/levels/back-alley/",
  "scene": "level-back-alley.svg",
  "cfg": { "showHitboxes": true },
  "checklist": [
    { "label": "Break the crates", "event": "break:crate-stack" },
    { "label": "Step into the ambush", "event": "event:alley-ambush" },
    { "label": "Enter the shop", "event": "enter:corner-shop" },
    { "label": "Walk back out", "event": "exit:corner-shop" }
  ]
}
```

## 6. Try it

Serve the folder (for example `python -m http.server 8000`), open
`http://localhost:8000`, and pick **SANDBOX TEST**. Each layer is outlined with its
id, the console lists every map id with where it landed, and each checklist row
ticks as you do it.

If a row never ticks, check the console warnings first: a misspelt prefix is
reported there.

## Next

- Make something happen when the crates break: [level-design_quickstart.md](level-design_quickstart.md)
- Animate a sign: `ANIMATE-<name>` with frames `objects/<name>_0.svg`, `_1`, ... ([level-naming.md](level-naming.md#animate-frame-animation))
- Lock the door: rename `ENTERABLE-corner-shop` to `RESTRICTED-corner-shop` ([level-naming.md](level-naming.md#restricted-locked-doors))

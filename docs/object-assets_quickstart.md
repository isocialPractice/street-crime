# Object Assets Quickstart

Add an animated neon sign and give a breakable crate stack its own damaged and
broken art. About 15 minutes. This uses the level from
[level-naming_quickstart.md](level-naming_quickstart.md); the full rules are in
[object-assets.md](object-assets.md).

## 1. Draw the sign in the level

In the level file, add the sign as two nested groups:

```text
OBJECT-neon-sign
  ANIMATE-neon-sign            the sign as it looks in frame 0
```

Outline any text (**Type > Create Outlines**) so it looks the same in every
browser. Export the level again.

## 2. Draw the frames

Copy the sign to a new Illustrator file, one artboard around it. Make three
versions (lit, flickering, dark) and export each as SVG with **Object IDs: Layer
Names** into the level's `objects/` folder:

```text
assets/levels/back-alley/objects/neon-sign_0.svg
assets/levels/back-alley/objects/neon-sign_1.svg
assets/levels/back-alley/objects/neon-sign_2.svg
```

Use the same artboard for all three. The artboard's padding does not matter: frame
0 is lined up with the sign in the level.

## 3. Set how it plays

In the `back-alley` test in `config/debug/sandbox.json`:

```json
"levelMap": {
  "enabled": true,
  "animate": { "neon-sign": { "mode": "yoyo", "fps": 4 } }
}
```

`yoyo` plays 0 1 2 1 0 1 2 ...; `loop` plays 0 1 2 0 1 2 ...

## 4. Give the crates state art

Draw the crate stack twice more, cracked and smashed, each on an artboard the size
of the stack in the level, and export:

```text
assets/levels/back-alley/objects/crate-stack_damaged.svg
assets/levels/back-alley/objects/crate-stack_broken.svg
```

Lower case, exactly those endings.

## 5. Try it

Start **SANDBOX TEST**. The sign plays from its frames and reports
`animate:neon-sign` after one full cycle; add a checklist row for it if you like:

```json
{ "label": "The sign flickers", "event": "animate:neon-sign" }
```

Hit the crates: the first blow shows the damaged art, the third the broken art.

If the sign stays still, the console says why: usually a frame name that does not
match the layer's `ANIMATE-<name>`, or a run that does not start at `_0`.

The full tables are in [object-assets_cheatsheet.md](object-assets_cheatsheet.md).

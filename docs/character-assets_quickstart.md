# Character Assets Quickstart

Give an existing enemy a new animation, using files and one config entry and no
code. About 15 minutes. The full rules are in [character-assets.md](character-assets.md).

The example adds a two-frame taunt to `CrimeGuy`, played when he gets back up
after being knocked down.

## 1. Draw and name the frames

In Illustrator, draw each frame on its own artboard, at the same size as his other
poses. Name the body-part groups the way his other files do (`front-glove`,
`back-shoe`, ...), so every frame has the same parts.

## 2. Export

Export each artboard as SVG with **Object IDs: Layer Names**, into
`assets/characters/enemy/`:

```text
CrimeGuy_taunt_0.svg
CrimeGuy_taunt_1.svg
```

Name them exactly like that, case included. Frames start at `_0` and run without
gaps.

## 3. Wire them in

In `config/enemy-assets.json`, under `"enemies"` → `"CrimeGuy"` → `"animations"`, add:

```json
"taunt": { "mode": "sequence", "suffixes": ["taunt"] }
```

`"taunt"` has no file of its own (`CrimeGuy_taunt.svg`), so it expands to the
numbered run `CrimeGuy_taunt_0.svg`, `_1.svg`. A third frame later needs only the
file.

## 4. See it

Reload the game, open debug mode, spawn a `crimeguy`, knock him down (an uppercut
does it, Up + J), and watch him get up: the taunt plays before he rejoins the
fight. The browser console warns if a named file cannot be found.

## Other things to try

- **Loop a walk back and forth:** `"walk": { "mode": "yoyo", "suffixes": ["walk"] }`
  with `CrimeGuy_walk_0.svg` to `_4.svg` plays 0 1 2 3 4 3 2 1.
- **Reuse frames:** a suffix that names another animation (`"preDefeat"`) pulls in
  all of its frames.
- **A brand new enemy:** the art and config work the same way, plus one line of
  stats in `js/entities/enemy.js`; see [character-assets.md](character-assets.md#adding-a-new-enemy).

The full tables are in [character-assets_cheatsheet.md](character-assets_cheatsheet.md).

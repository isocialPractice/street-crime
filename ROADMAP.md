# Street Crime ROADMAP

The plan behind `TODO.md`: what order the work goes in, what depends on what,
and which questions are holding things up until someone answers them.

## What this file is, and what `TODO.md` is

`TODO.md` is the queue. It holds every item, and for the newer sections each
item's **Issue**, **Goal** and where it came from. It is worked one item at a
time.

This file is the plan around that queue. It says nothing about *how* an item is
done, which is the item's own Goal, and everything about *when* it should be,
and what goes wrong if the order is wrong.

When the two disagree, `TODO.md` is right about what the work is and this file
is right about when it happens. An item that contradicts a sequence here has
usually learned something, and this file is what gets corrected.

## Where the game is now

Measured 2026.11.14.

| | |
| --- | --- |
| What it is | A 2.5D side-scrolling beat-em-up in plain HTML5 Canvas and JavaScript, with no build step: 38 scripts under `js/` plus `game.js`, about 14,200 lines |
| What it plays | Three stages defined in `STAGES` (`js/level/data.js`), run by `LevelMgr`; debug mode with live tuning; SANDBOX TEST, which loads one level from its SVG's layer names and runs its `level-design.json` |
| Levels from art | One: `theStreets`, with a door, a locked warehouse, a breakable gate, an animated sign, a hole, a key to take, and a design in which the gate breaking sends a crew out of the warehouse, and the key decides whether a second crew fights or runs. Items, an item screen and a command line come with it. Proven in eleven sandbox tests, step by step |
| Characters | 24 enemies in `ENEMY_DEFS`: 12 configured in `config/enemy-assets.json`, 13 listed as work in progress |
| Size | 20M, of which `assets/` is 18M (426 SVGs). Illustrator sources live in the git-ignored `support/` |
| Docs | 15 pages in `docs/`, plus `QUICKSTART.md` and `CHEATSHEET.md`. The site is built by `.github/workflows/pages.yml` and not yet deployed: Pages still publishes in legacy mode |
| Tests | None automated. `scripts/checkLevelDesignVocab.js`, `scripts/checkAssetCase.js` and `scripts/stageDocs.js` are checks, the last two run by the Pages workflow. The level design was verified with headless browser runs kept out of the repository |
| Queue | 165 open items and 37 done. 42 are under `## Current`, of which 7 are the user's own (`User Only - Update Assets`) and are not counted as work for anyone else |
| Release mode | Dated: `CHANGELOG.md` entries are `[YYYY.MM.DD]`, with no versions, tags or releases |

**The level format is further along than the game that uses it.** A level built
from layer names and a design file runs only in SANDBOX TEST. The three real
stages still come from `STAGES`, and `config/levels.json` still reports "not
built yet". Closing that gap is the next phase, and the reason the template
cannot start yet.

## What a section's intent line means

The changelog is in dated mode, so no version is ever cut, and the newer `TODO.md`
sections carry an `Intent:` line instead of a version weight. It says what the
section is for, in one line, so an item that does not serve it stands out.

## The arc

Three horizons, in the order they have to happen.

1. **A level built from its art.** Reached in the sandbox: name the layers, write
   one design file, play it. What is left is making a real stage load that way.
2. **A game someone else could extend.** Stages written as design data, enemies
   picked by tier, asset names regular enough to be discovered rather than listed,
   tests that say a change broke nothing, and docs that stay true.
3. **The template.** `TODO.md` section 9: this repository cut down to one sample
   character, enemy and level, published as a GitHub template whose docs and demo
   publish from the first push.

## Sequence

### Now: get the site live

`TODO.md` › Current › **Documentation Site**: switch the Pages source to GitHub
Actions, then verify the first deploy. Both need a person, so they come first:
the workflow is already merged and builds on every push, and the README already
links to the docs. Until the switch, the docs show unstyled.

### Next: real levels through the director

1. `TODO.md` › Current › **Level Map**: load a level from `config/levels.json`
   through the level map and `LevelDirector`, the way the sandbox's `level-design`
   test does.
2. Section 10 › **Stage waves as design states**, so the three stages can move
   onto the same path and `LevelMgr` can retire.
3. Section 10 › **Rosters**, which the waves want as soon as they are data: a wave
   says "three grunts", not three ids.
4. Section 10 › **`extends`**, once there are several levels with states to share.

Out of order, the cost is double work: rosters or `extends` designed before levels
load for real would be shaped by the sandbox alone.

### Then: names the template can rely on

Section 9 › the naming contract, the action vocabulary, normalizing this
repository's names, then the manifest generator; with `TODO.md` › Current ›
**Asset Scripts** (porting `artboards.jsx` and `groups.jsx`, which enforce the
names in Illustrator).

Normalizing must come before the manifest. A manifest written to tolerate
`Ideal` for `idle`, mixed case and frames from `_1` would carry those exceptions
into the template.

### Alongside: art

`TODO.md` › Current › **User Only - Update Assets** and the **Level Map** art
items: the warehouse interior, the parked car in front of the warehouse door, the
BAD BAR sign's outlined text, trimming `#field`. None of it blocks the engine
work, but `theStreets` is the level the docs and the demo show, so it is the art
worth finishing first.

### Alongside: keep the docs true

Section 11, continuously. Every change to `js/level/`, `config/schema/` or the
asset loaders updates its page in the same commit.

### Alongside: automated tests

Section 10 › **Automated tests for the level design code**, and section 8's CI
workflow. They have to land before the template, which hands this code to people
who did not write it.

### Then: the template

Section 9 › the sample level, stripping the game content, the docs site shipping
with the first-run script rewriting names and URLs, and publishing.

### Later: the rest of the game

Sections 1 to 8: co-op, gamepad support, character select, save and load, more
stages, effects, audio, the HUD. Worth doing on the template's engine, after it
exists, rather than before.

## Open decisions

None can be settled by working an item.

1. **Entity type: folders or a name prefix** (section 9). Blocks the manifest
   generator and the template's folder layout.
2. **Where rosters live**: one `config/rosters.json`, or per level. Blocks
   section 10's rosters.
3. **What `"spawn": "left"` means after a fade mid-level.** Today it is the
   level's left edge, so the player is taken back to the start of the street,
   which suits an end-of-level handover. A mid-level fade might want the left of
   the current screen instead.
4. **Interiors as folders.** The first naming draft lets an interior be a folder
   with rooms of its own; today it is one SVG. Blocks nested enterables.
5. **Whether the template ships its docs site on.** It needs the Pages source
   switched by each new repository's owner, so it cannot simply be on.

## Not planned, on purpose

- **A build step or bundler for the game.** Serving the folder is the whole
  install, and the template depends on that staying true.
- **A site generator beyond GitHub Pages' own Jekyll.** No toolchain to install
  and nothing to keep versioned.
- **Coordinates in `level-design.json`, or timing in layer names.** The SVG says
  where and what, the design says when.
- **Correcting layer paths in version 1 designs.** A draft's wrong layer path is
  corrected to the nearest real one, with a note. A version 1 file only gets a
  suggestion, so a finished design never runs on a guess.

## Maintaining this file

Update it when a phase completes, when an open decision is answered, or when an
item teaches something that changes the order. Re-measure the table under
**Where the game is now** at the same time.

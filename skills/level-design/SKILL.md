---
name: level-design
description: 'Make, change, explain or check a level in this repository (street-crime). Turns a plain description or a level brief into config/levels/<level>/level-design.json, a SANDBOX TEST entry and the layer names the art needs, using survival-horror and adventure-game techniques the engine has built: locked doors and keys, rooms that clear, ambushes, crews that run off or come back, items that decide what happens, LOOK and TALK. Proves with scripts/checkLevelDesign.js that every player action, in every state, does what was asked. Use for a level, a level design, level-design.json, a level brief, enemies spawning, places that are open or locked, keys or items in a level, or "what happens when the player ...".'
---

# Level Design

Writes a level for this repository's engine from what someone wants to happen, so
nobody has to learn the format first. One rule holds throughout: **the SVG says where
and what, the design says when.** Layer names in the art make the places;
`config/levels/<level>/level-design.json` makes things happen in them.

Paths are from the repository root, except those starting `references/` or
`templates/`, which are this skill's own folders. The folder an agent reads is a copy
made by `npm run skills`; the skill itself is `skills/level-design/`, which is where
any change to it goes.

## Read first

| File | For |
| --- | --- |
| `references/brief-guide.md` | turning a request into a brief: its sections, what to ask, what common phrases become |
| `references/patterns.md` | every technique the engine has, each with a checked design to start from |
| `references/pitfalls.md` | the mistakes earlier levels made, and how the checks show them |
| `references/vocabulary.md` | every key, value, trigger and layer prefix the engine reads (generated; nothing else exists) |
| `config/levels/theStreets/level-brief.md` and `level-design.json` | the worked example |
| `docs/level-design.md`, `docs/level-naming.md`, `docs/inventory.md` | the full contract, for a detail the references leave out |

## Modes

The words of the request decide the mode. They are not options of the check script.

| Mode | Asked like | Steps | Writes |
| --- | --- | --- | --- |
| **Describe** (default) | "the corner shop stays locked until the alley gang is beaten" | all | a brief, the design, a sandbox test, the art to-do |
| **Brief** | "build the level from config/levels/corner-shop/level-brief.md" | all | the design, a sandbox test, the art to-do, the brief's **Built as** |
| **Shorthand** | `()=>` lines or half-written JSON in a design file | 1, 2, 5 to 9 | the file as version 1, shorthand removed |
| **Change** | "make the crew come every time I walk out" | 1, 2, then 3 to 9 for what changes | the smallest edit to the brief, then the design |
| **Explain** | "explain theStreets", "what happens in theStreets?" | 1, 2, 6 | nothing: the Explain report |
| **Check** | "check theStreets", "check this design" | 1, 2, 6 | nothing: the Check report |

## Workflow

1. **Find the level.** The art is `assets/levels/<level>/level-<level>.svg`, with
   interiors in `enterables/` and frames in `objects/`. A level's design is
   `config/levels/<level>/level-design.json`, its brief `level-brief.md` beside it.
   A SANDBOX TEST step design is `config/debug/designs/<n>-<name>.json`, its brief
   `<n>-<name>.brief.md` beside it. A level whose art does not exist yet is fine:
   everything the art must carry goes on the art to-do list, and the check waits for
   the art.
2. **Read the art's names.**

   ```sh
   node scripts/checkLevelDesign.js <level> --layers
   ```

   It lists doors (with the path a design writes), locks and what opens them,
   breakables, items, trigger areas and interact areas, for the street and each
   interior. `--names` lists every layer name, for layers to slide or parts to
   recolor. A design no sandbox test runs yet needs `--svg <file>` for its art and
   `--items config/debug/items.json` for its items, and `--brief <file>` when its
   brief is not beside it; a design file outside the repository works the same way.
   Never write a layer name that is not listed without putting it on the art to-do
   list.
3. **Write the brief** (`templates/level-brief.md`, following
   `references/brief-guide.md`). Ask only what the request and the art cannot
   answer, at most three questions at a time. When the request does not say, always
   ask: what happens **the second time** the player does each thing, and how the
   level **ends or starts over**.
4. **Pick a pattern for each beat** from `references/patterns.md`. When a beat needs
   one marked **planned**, say so in one line, offer the nearest built pattern, and
   name the TODO item. Never stand a planned pattern in with one that looks similar.
5. **Write the design**, from `templates/level-design.json` or the nearest pattern:
   version 1, a `$schema` of `../../schema/level-design.schema.json`, a crew used in
   two states defined once under `groups`, an item that decides something made a case
   (`{ "condition": "inventory:<item>" }`), no coordinates.
6. **Check it.**

   ```sh
   node scripts/checkLevelDesign.js <level> --matrix
   ```

   Repeat until the first line ends `design: 0 warnings` and the matrix says
   `0 gaps`. For each gap, either add the step, or, when doing nothing is meant,
   list it in the brief's **Nothing on purpose** with the trigger and the state in
   backticks. Never mark a gap meant without asking, unless the brief already says
   so in other words. Then read what the gaps cannot see, state by state:
   - **Doors:** each state's line (`open`, `locked`, `open at times`) against the
     brief's **Places**. A door the brief says is locked but the matrix shows open
     is no gap, and still wrong; usually a case still follows a condition from an
     earlier state, and that state's `set` should make it `false`.
   - **Cannot here** against **People** and **Things**: whatever the brief means to
     happen there must not be listed.
   - **Notes:** a door that opens a state early, or a state that ends the level.
     Fix one that is wrong; list one that is expected under **Nothing on purpose**
     (for a door, its `enter:` or `exit:` trigger and the state).
   "Locked at times" in a row means the door's lock follows a case that changes
   during that state. "Can get stuck" is a gap: some way into the state leaves none
   of its steps able to fire, such as a crew lost in a building (see
   `references/pitfalls.md`).
7. **Add a SANDBOX TEST** to `"tests"` in `config/debug/sandbox.json`, from
   `templates/sandbox-test.json`: copy the level's settings (`sectionWidth`,
   `worldHeight`, `spawn`, `levelMap`, `enterables`) from a test that already uses
   the same art, and give it one checklist row per beat, its label starting with the
   beat's number (tests older than this skill, such as `level-design`, are not
   written that way). Leave `"active"` as it is unless asked. Check again by the
   test's key, which brings its item catalog and interiors:
   `node scripts/checkLevelDesign.js <test-key> --matrix`.
8. **Fill the brief's Built as table**: each beat, its state, its step or rule.
9. **Report** (below).

## Writing the design

- **A step on an event counts only while its state is current.** When the player
  can do the same thing again after a step has moved the level on, give the state it
  leads to the same step, or doing it again does nothing. The matrix flags exactly
  this: `does nothing, but in <state> it led here`.
- `when` reads cases only. The first step that fires wins: put a step with `when`
  before the general one.
- A lock that should close again takes `"type": "condition"`. A case that should be
  false until a crew is out follows `alive = 0` from the state that brings the crew
  (a state's `cases`), not from the top.
- `"from": "edges"` brings a crew into the scene the player is in when the state
  starts, inside a building too. The street does not move while the player is
  inside: nobody out there is beaten, runs off or heals.
- A crew inside a building is lost when the player walks out on it: gone, but still
  counted by its group, so its `defeated:` never comes. Give walking out a step to a
  state that waits, and walking back in a step that brings the crew again with
  `"inherit": true` (the pattern "Ambush when you take it").
- Re-entering a state starts its spawns again; a crew still standing then is no
  longer counted by that group's `defeated:`.
- Some reports go out once per run (`break:`, `event:`, `state:`), some each time
  they become true again (`case:`, a group's `defeated:` after it starts again), and
  doors, `take:` and the player's words every time. See `references/pitfalls.md`.
- Names are kebab-case. Name states for what is happening (`gang-arrives`,
  `still-dark`), cases for what is true (`has-key`, `street-clear`).

## Rules

- The SVG says where and what, the design says when: no coordinates in the design,
  no timing in layer names.
- Only names that exist: layer paths from step 2, enemy ids or art names from
  `ENEMY_DEFS` (`js/entities/enemy.js`), items from the catalog, palettes from
  `config/palettes.json`, keys and words from `references/vocabulary.md`.
- Never edit engine code (`js/`), the schema or the vocabulary. A request that needs
  engine work gets a TODO item in `TODO.md`'s format, offered, not written.
- Never edit art. Missing layers go on the art to-do list, each with where it sits
  (`INVENTORY-key` inside an `OBJECT-` layer, for example).
- An item the level needs and the catalog lacks: offer its catalog entry
  (`config/debug/items.json`, with a `look` line) and list its art on the art to-do.
- Techniques, never content: no names, characters, rooms, puzzles or art from any
  existing game.
- Placeholder names in docs and examples (`corner-shop`, `alley-gang`), no em or en
  dashes, and nothing about the request itself in what is written.
- Never commit.

## The report

```text
Level <level>: <one line on what it is>
Written: <each file>
Art to-do: <layer> inside <parent>, ...   (or: none)
Beats: B1 <state>, B2 <state>, ...
Checked: design 0 warnings; matrix 0 gaps, <n> meant
Chosen for you: <each default>             (any of them can change)
Planned, not built: <each, with its TODO item>   (or: none)
Play it: SANDBOX TEST, pick "<label>" from the panel's list
```

**Explain**: the story beat by beat, in the brief's words where there is one, then a
short table per state of what each action does, then each gap, and anything step 6
found, as a question.

**Check**:

```text
Checked <file> (art <svg>, items <catalog>, brief <brief or none>)
Warnings: <each, or none>
Gaps: <each, with its fix: the step to add, or the brief line that would mean it>
Also: <doors, "cannot here" or notes that disagree with the brief, with the fix>
```

## Commands

| Command | Does |
| --- | --- |
| `node scripts/checkLevelDesign.js <level>` | the sandbox's status line: map, items and design warnings |
| `... --layers` / `--names` | the art's mapped layers by kind, with interiors / every layer name |
| `... --matrix` | what every action does in every state, and the gaps |
| `... --json` | the same, for reading back |
| `... --svg <file>` / `--items <file>` / `--brief <file>` | art, catalog or brief no sandbox test names (also for a design outside the repository) |
| `node scripts/checkLevelDesign.js --all --matrix` | every sandbox test |
| `node scripts/checkLevelDesignVocab.js` | the vocabulary, the schema and this skill's own pages agree |
| `npm run skills:check` | whether the agents' copies of this skill are current |

`npm run level:check -- <level> --matrix` is the same as the `node` line. `<level>`
can also be a sandbox test's key or a design file's path. Exit code 0 means no
warnings and no gaps the brief does not mean.

## Examples

**Describe.** "In the corner shop level, the back room is locked until the two thugs
outside are beaten, and there is a flashlight inside." The art has
`RESTRICTED-back-room` but no flashlight layer. Ask: "When the player walks out of
the back room, should anything happen?" and "Does the level end, or start over, and
when?" Then write the brief (B1 the thugs come out of the shop, B2 the back room
opens, ...), the design from "The room clears", the sandbox test, and the art to-do:
`INVENTORY-flashlight` inside an `OBJECT-` layer in `enterables/back-room.svg`.

**Change.** "Walking out of the warehouse a second time brings nobody." Read the
brief's **Again and again**; run the matrix; it shows the state where walking out
does nothing although it led there. Add the step to that state, or ask whether
nothing is meant, and record the answer in the brief.

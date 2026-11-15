# The level-design skill

An agent skill that belongs to this repository. Describe a level in plain words, or
fill in a level brief, and the skill writes the level design for you: the
`level-design.json` that says when things happen, a SANDBOX TEST entry whose
checklist proves each part, and the list of layer names the art still needs. It
works in Claude Code, GitHub Copilot and Codex.

It is for anyone who would rather say what happens than learn the format. Everything
it writes is the format described in [level-design.md](level-design.md), so a level
it makes can be read and changed by hand like any other.

Also as a [quickstart](level-design-skill_quickstart.md) and a
[cheatsheet](level-design-skill_cheatsheet.md).

## What it does

1. Reads what you want: a sentence or two, a filled-in brief, or a half-written design.
2. Reads the level's art, so it only names layers that exist (and lists the ones that
   do not yet).
3. Writes a **brief**: the level in plain words, with every beat numbered.
4. Picks a technique for each beat from its pattern library: locked doors and keys,
   rooms that clear, ambushes, crews that run off or come back, items that decide
   what happens, LOOK and TALK.
5. Writes the design, then checks it with the same code SANDBOX TEST runs, and with
   a table of what every player action does in every state, until nothing is left
   that the brief does not mean.
6. Adds a sandbox test, and tells you how to play it.

What it never does: draw or edit art, change the game's code, or commit. When a
request needs something the engine does not have yet, it says so, offers the nearest
thing that is built, and names the `TODO.md` item.

## Installing it

You need Node 18 or later, and one of the agents. Nothing has to be installed from
npm: `package.json` only holds the scripts.

```sh
npm run skills -- claude      # Claude Code
npm run skills -- copilot     # GitHub Copilot
npm run skills -- codex       # Codex
npm run skills -- all         # all three
```

Each command copies `skills/level-design/` to where that agent reads project skills:

| Agent | Folder |
| --- | --- |
| Claude Code | `.claude/skills/level-design/` |
| GitHub Copilot (VS Code, Visual Studio, Copilot CLI) | `.github/skills/level-design/` |
| Codex | `.agents/skills/level-design/` (VS Code's Copilot reads it too) |

`npm run skills` with no agent installs for the agent folders the checkout already
has (`.claude/`, `.github/skills/` or `.agents/`); in a fresh clone it says how to
choose. Without npm, run `node scripts/installSkills.js claude` and so on.

The copies are made, not linked, and git ignores them. `skills/level-design/` is the
one to edit and commit.

### Keeping it up to date

After pulling changes to `skills/`, check the copies and install again:

```sh
npm run skills:check
npm run skills -- claude
```

| `skills:check` says | It means |
| --- | --- |
| current | the copy matches the skill |
| out of date | the skill changed since the copy was made: install again |
| edited | someone changed the copy itself: move the change into `skills/level-design/`, then install again (or `--force` to throw it away) |
| not installed by this script | a folder of that name the installer did not make: it is never replaced or removed without `--force` |
| not installed | no copy for that agent |

`npm run skills -- --remove claude` removes a copy the installer made, and nothing
else. `--dry-run` says what any command would do without doing it.

## Calling it

| Agent | Type |
| --- | --- |
| Claude Code | `/level-design <what you want>` |
| GitHub Copilot in VS Code | `/level-design <what you want>` in chat |
| Codex | `$level-design <what you want>` |

All three also use it on their own when a request is about a level, so "make the
back room open once the thugs are beaten" works without the name.

What you ask decides what it does:

| You ask | It does | It writes |
| --- | --- | --- |
| "the corner shop stays locked until the alley gang is beaten" | **Describe**: builds the level | a brief, the design, a sandbox test, the art to-do |
| "build the level from config/levels/back-alley/level-brief.md" | **Brief**: builds from a brief you wrote | the design, a sandbox test, the art to-do |
| "finish the shorthand in back-alley's design" | **Shorthand**: turns `()=>` notes or half-written JSON into a version 1 design | the design |
| "make the gang come back every time I leave the shop" | **Change**: the smallest edit to the brief, then the design | both |
| "explain back-alley", "what happens in back-alley?" | **Explain**: the story beat by beat, and what each action does | nothing |
| "check back-alley" | **Check**: warnings and gaps, each with its fix | nothing |

## A first level

Say the art for a `back-alley` level is drawn, with an `ENTERABLE-corner-shop` and a
`BREAKABLE-crate-stack` inside an `OBJECT-crate-stack`:

```text
/level-design In back-alley, breaking the crates brings two of the alley gang out of
the corner shop, one at a time. Once both are beaten, the shop is safe to go into.
```

It reads the art first (`node scripts/checkLevelDesign.js back-alley --layers`) and
asks only what the request and the art cannot answer, at most three questions at a
time. Two it always asks when you have not said:

- **The second time.** "When the player walks out of the shop again, should anyone
  come?" A level is only predictable once every repeat is decided.
- **The end.** "Does the level end once the shop is safe, or start over?"

Then it writes `config/levels/back-alley/level-brief.md`, the design beside it, and a
sandbox test, checks them, and reports:

```text
Level back-alley: the alley gang guards the corner shop
Written: config/levels/back-alley/level-brief.md, config/levels/back-alley/level-design.json,
         config/debug/sandbox.json ("back-alley")
Art to-do: none
Beats: B1 quiet, B2 gang-out, B3 cleared
Checked: design 0 warnings; matrix 0 gaps, 0 meant
Chosen for you: the gang fights; walking out of the shop again brings nobody
Planned, not built: none
Play it: SANDBOX TEST, pick "Back alley" from the panel's list
```

Every default it picked is listed, so none is hidden. Play it, and ask for a change
in the same words you would use for a person.

## The brief

A brief is the level the way a person thinks of it. It lives beside the design:
`config/levels/<level>/level-brief.md` for a level, or
`config/debug/designs/<n>-<name>.brief.md` for a SANDBOX TEST step design. The skill
writes one, or reads one you filled in from
[its template](../skills/level-design/templates/level-brief.md). Change the brief
first, then ask the skill to change the design to match.

| Section | Holds |
| --- | --- |
| **The level** | the art, the level in one line, how the player comes on |
| **Places** | every building and area: open, locked until something, or open only while something holds |
| **People** | each crew: how many, who, from where, one by one or all at once, and whether they fight, run off or come back |
| **Things** | each item, where it lies, and what it is for |
| **What happens** | numbered beats, `B1.` to `Bn.`, each "when this, that" |
| **Again and again** | what doing each thing a second time does |
| **Nothing on purpose** | actions meant to do nothing in a state (the check reads this) |
| **Test** | the sandbox test, and what to try, in what order |
| **Built as** | each beat, its state, and its step (filled by the skill) |

### Writing it well

- One beat per line, starting with what the player does or what becomes true:
  "When / Once / Every time ..., ... happens".
- Say **first time** or **every time**. If you do not, you will be asked.
- Name things by what the player sees: "the shop door", "the key on the counter".
  The skill matches them to layer names, and lists any it cannot match.
- Give counts and order: "three, one by one", "four at once from both sides".
- Say how the level ends, or that it starts over.
- Leave out where things are: that belongs to the art, never the brief.

### Nothing on purpose

The check reads this section to tell a gap you meant from one you did not. Each
bullet names the trigger and the state in backticks, then says why:

```markdown
- `exit:corner-shop` in `ambush`: they are already waiting; going in and out again brings no one new.
```

A trigger alone means every state; a state alone means it is meant never to be
reached, or to end the level.

### An example

```markdown
# Back alley

## The level
Art: `assets/levels/back-alley/level-back-alley.svg`
In one line: the alley gang guards the corner shop.
The player starts: walking in from the left.

## Places
- The corner shop: open, but the gang comes out of it.

## People
- Alley gang: two, a CrimeGuy and a JumpingJunkie, out of the shop door one by one; they fight.

## What happens
B1. The level starts: the player walks in from the left.
B2. Breaking the crates: the gang comes out of the corner shop, one at a time.
B3. Both beaten: the alley is quiet.

## Again and again
- Walking out of the shop: nobody comes, ever.

## Nothing on purpose
- `exit:corner-shop` in `cleared`: the gang came once; walking out again brings nobody.
```

theStreets has the worked example: `config/levels/theStreets/level-brief.md`.

## What it writes, and what it never touches

| Writes | Never touches |
| --- | --- |
| `config/levels/<level>/level-design.json` and `level-brief.md` (or a step design and its brief in `config/debug/designs/`) | art: missing layers go on the art to-do, each with where it sits |
| a test in `config/debug/sandbox.json` (leaving `"active"` alone unless asked) | the game's code in `js/`, the schema, the format's vocabulary |
| a new item's entry in `config/debug/items.json`, when you agree | git: it never commits |

## The checks

The skill runs these, and so can you. None needs a browser.

```sh
node scripts/checkLevelDesign.js theStreets
```

prints the same status line SANDBOX TEST shows, from the same code:

```text
Level design: gate breach (config/levels/theStreets): ready, 9 regions, 1 warning, items: 0 warnings, design: 0 warnings
```

The target can be a level (`theStreets`), a sandbox test's key (`design-9-conditions`)
or a design file. A design no sandbox test runs needs `--svg` for its art,
`--items config/debug/items.json` for its items, and `--brief` when its brief is not
beside it. `npm run level:check -- theStreets` is the same command.

| Option | Adds |
| --- | --- |
| `--layers` | every mapped layer by kind, with the path a design writes, and each building's interior |
| `--names` | every layer name in the art, for layers to slide or parts to recolor |
| `--matrix` | what every action does in every state, and the gaps |
| `--all` | every sandbox test, one line each |
| `--json` | the result as JSON |

It reads names only: where things are, and whether the player can reach them, is
still SANDBOX TEST's to check, as is timing (bodies falling, fades, `after`).

### What every action does: `--matrix`

The design is played over what the files say: which building the player is in,
each case, each crew (not come, out, beaten, ran off), what is carried, taken and
broken. For each state you get a table like this one (from the pattern "Ambush on
the way out", with its brief line left out):

```text
### ambush

| Action | Does |
| --- | --- |
| into corner-shop (`enter:corner-shop`) | nothing |
| out of corner-shop (`exit:corner-shop`) | nothing |
| street-toughs beaten (`defeated:street-toughs`) | to street |

Doors: corner-shop open; back-room locked.

### Gaps

- ambush: out of corner-shop (exit:corner-shop) does nothing, but in street it led here
```

| It says | It means |
| --- | --- |
| `does nothing, but in <state> it led here` | an action moved the level on, and doing it again does nothing: add the same step to that state, or list it under **Nothing on purpose** |
| `can get stuck: ...` | some way into the state leaves none of its steps able to fire, such as a crew lost in a building the player walked out of |
| `has steps, but none of them can fire` | no way on at all |
| `never entered`, `never fires` | a state or step the level cannot reach, with the reason |
| `(locked at times)` | the door's lock follows a case that changes during the state |
| `Doors:` | each building, seen from the street in that state: compare it with the brief's **Places** |
| `Cannot here:` | actions not possible in that state, and why |
| a note | worth reading, not a gap: a locked door that opens before the state with its step, or a state that ends the level |

The exit code is 0 when there are no warnings and no gaps the brief does not mean.

`node scripts/checkLevelDesignVocab.js` checks the skill itself: that its list of
names is current, that every name its pages give exists, and that every design in
its pattern library passes.

## The pattern library

Every technique has a design that is checked by running it:
[patterns.md](../skills/level-design/references/patterns.md). In short:

| About | Built |
| --- | --- |
| places | key and locked door; a lock that follows what is carried; the room clears; locks behind you while they stand; a step on the ground; a door that slides open; rooms behind doors |
| people | out of a door one by one; ambush on the way out, every time; ambush when you take it; they remember (come back with their health); a look and a run; talking brings friends; a recolored copy of an enemy |
| things | something to take; it decides the ending; combining two items; use it now; room in your pockets |
| words and story | LOOK at anything; story flags, and putting things back; starting over; no dead ends |

**Planned**, and said so whenever asked for: characters who will not fight, item
storage, each level's own items, a map of which doors are open, a spent key freeing
its slot, weapons, showing and hiding layers, a trigger area that fires every time,
rooms inside rooms, points, and a narrator's line. Its
[pitfalls](../skills/level-design/references/pitfalls.md) list the mistakes earlier
levels made.

## Troubleshooting

| Problem | Try |
| --- | --- |
| The agent does not list the skill | `npm run skills:check`; install it for that agent; in Claude Code, accept the workspace trust dialog, which project skills need; open a new chat |
| `edited since it was installed` | someone changed the agent's copy: move the change into `skills/level-design/`, then `npm run skills -- <agent>` |
| `no sandbox test runs <file>` | give the art with `--svg assets/levels/<level>/level-<level>.svg` |
| A step design shows gaps you meant | its brief is `<design>.brief.md` beside it; list them under **Nothing on purpose**, or pass `--brief` |
| The check passes, the level does not | the check reads names, not places or timing: play it in SANDBOX TEST, going into a building just as a fight ends, and doing each thing twice |

## Changing the skill

Edit `skills/level-design/` (never an agent's copy). Then:

```sh
node scripts/checkLevelDesign.js --vocabulary skills/level-design/references/vocabulary.md   # after a change to the format
node scripts/checkLevelDesignVocab.js                                                         # the skill agrees with the engine
npm run skills                                                                                # update the copies
```

A new design in the pattern library needs a marker line before its JSON:
`<!-- checked -->` (or `<!-- checked; meant: ... -->`), and is checked against a
small made-up street, `scripts/lib/patternFixture.js`.

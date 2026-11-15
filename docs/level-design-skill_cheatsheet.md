# Level Design Skill Cheatsheet

The `level-design` agent skill, for someone who has used it. The reasons are in
[level-design-skill.md](level-design-skill.md).

## Install

| Command | Does |
| --- | --- |
| `npm run skills -- claude` (`copilot`, `codex`, `all`) | copy `skills/level-design/` for that agent |
| `npm run skills` | for the agent folders the checkout has |
| `npm run skills:check` | each copy: current, out of date, edited, not installed |
| `npm run skills -- --remove <agent>` | remove a copy the installer made |
| `--force`, `--dry-run` | replace an edited copy; say what would happen |

## Call it

| Agent | Type | Folder |
| --- | --- | --- |
| Claude Code | `/level-design ...` | `.claude/skills/` |
| Copilot (VS Code) | `/level-design ...` | `.github/skills/` |
| Codex | `$level-design ...` | `.agents/skills/` |

## Modes

| Ask | Mode | Writes |
| --- | --- | --- |
| what should happen | Describe | brief, design, sandbox test, art to-do |
| "build from <brief>" | Brief | design, sandbox test, art to-do |
| `()=>` notes in a design | Shorthand | design |
| "make ... every time" | Change | brief, then design |
| "explain <level>" | Explain | nothing |
| "check <level>" | Check | nothing |

## The brief

| Section | One line on |
| --- | --- |
| The level | art, one-line pitch, how the player comes on |
| Places | open, locked until, open while |
| People | how many, who, from where, how they come, fight / run / return |
| Things | where it lies, what it is for |
| What happens | `B1.` ... beats: "when this, that" |
| Again and again | the second time, for everything |
| Nothing on purpose | `` `<trigger>` in `<state>`: why `` |
| Test | the sandbox test, what to try |
| Built as | beat, state, step (the skill fills it) |

Lives beside the design: `config/levels/<level>/level-brief.md`, or
`config/debug/designs/<n>-<name>.brief.md`.

## The checks

| Command | Shows |
| --- | --- |
| `node scripts/checkLevelDesign.js <level>` | the sandbox's status line |
| `... --layers` / `--names` | layers by kind with paths / every layer name |
| `... --matrix` | each state's actions, doors, gaps |
| `... --svg`, `--items`, `--brief` | for a design no sandbox test runs |
| `node scripts/checkLevelDesignVocab.js` | the skill agrees with the engine |

| Matrix says | Do |
| --- | --- |
| `does nothing, but in <state> it led here` | same step in that state, or Nothing on purpose |
| `can get stuck` | a way out for that case (a crew lost in a building: wait, then `inherit`) |
| `never entered`, `never fires` | fix the step, or Nothing on purpose |
| `Doors:` | read against Places |

How to check it: `npm run level:check -- <test-key> --matrix` gives exit 0, then play
it in SANDBOX TEST.

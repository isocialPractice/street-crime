# Level Design Skill Quickstart

The short version: describe a level, let the `level-design` skill write it, play it.
About ten minutes, on theStreets' art, so there is nothing to draw. The full page is
[level-design-skill.md](level-design-skill.md).

## 1. Install it for your agent

```sh
npm run skills -- claude
```

Or `copilot`, or `codex`. Nothing to `npm install`.

## 2. Describe the level

In Claude Code or VS Code's Copilot chat (in Codex, `$level-design`):

```text
/level-design Make a sandbox level on theStreets' art: breaking the parking gate arm
brings two thugs out of the bar, one at a time. Once both are beaten, the warehouse
opens. Walking out of the warehouse starts the level over.
```

## 3. Answer its questions

It asks only what it cannot work out, usually two things: what happens **the second
time** the player does something (walks out of the bar again, say), and how the
level **ends**. One-line answers are fine.

## 4. Play it

Its report ends with the test to pick. Start the game, choose **SANDBOX TEST**, and
pick that test from the panel's list. The checklist ticks as each beat happens.

## 5. Change one thing

```text
/level-design make the thugs come back every time I leave the bar
```

It changes the brief first, then the design, and checks both again.

## Check it yourself

```sh
npm run level:check -- <test-key> --matrix
```

`design: 0 warnings` and `0 gaps` mean every action in every state does what the
brief says. Timing (fades, bodies falling) is SANDBOX TEST's to show.

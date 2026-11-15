# Writing a level brief

A brief is the level written the way a person thinks of it: places, people, things,
and what happens, in plain words. It lives beside the design, so the reason for every
state stays with the file that runs it: `config/levels/<level>/level-brief.md` for a
level's own design, `config/debug/designs/<n>-<name>.brief.md` for a SANDBOX TEST
step design. The skill writes one from a request, or reads one someone filled
in from `templates/level-brief.md`, and keeps the two in step: a change goes into the
brief first, then the design.

The worked example is `config/levels/theStreets/level-brief.md`.

## The sections

| Section | Holds | When it is missing |
| --- | --- | --- |
| **The level** | the art file, the level in one line, how the player comes on | ask for the art's level name; the player walks in from the left |
| **Places** | every building and area, and whether it is open, locked until something, or open only while something holds | open, unless the art makes it `RESTRICTED-` |
| **People** | each crew: how many, who, from where (a door, both edges), one by one or all at once, and whether they fight, run off, or come back | ask how many and from where; they fight |
| **Things** | each item: where it lies, and what it is for | an item the art holds is there to take, and does nothing else |
| **What happens** | numbered beats, `B1.` to `Bn.`, each "when this, that" | ask; this is the level |
| **Again and again** | what doing each thing a second time does | **always ask** |
| **Nothing on purpose** | the actions meant to do nothing in a state, read by the check | filled from the answers to "the second time" |
| **Test** | the sandbox test, and what to try in what order | the sandbox test's checklist, in beat order |
| **Built as** | each beat, its state, its step or rule | filled by the skill once the design is written |

## Reading a request

What people say, and what it becomes. The patterns are in `patterns.md`.

| They say | It becomes |
| --- | --- |
| "locked until ..." | a `RESTRICTED-` building, opened by a `REQUIRE-` layer, or by a `restricted` entry whose `until` names a case |
| "opens once everyone is beaten" | a case following `alive = 0`, taken up by the state that brings the crew; the lock follows the case (The room clears) |
| "locked again while they fight" | the lock's `"type": "condition"` (Locks behind you while they stand) |
| "comes out of the door one by one" | a spawn `from` the door's path, with `every` (Out of a door, one by one) |
| "from both sides at once" | `"from": "edges"`, `"order": "load"` |
| "three of them, random" | `count` 3, `"pick": "random"`, a `pool` |
| "one of them in gray" | a pool entry with `render` |
| "they look and run" | `"then": "flee"` (A look and a run) |
| "they come back as hurt as they were" | `"inherit": true` (They remember) |
| "if you have the key" | a case following `inventory:key`, then `when` |
| "when you pick it up" | a step on `take:<item>` (Ambush when you take it) |
| "when you walk past the alley" | an `EVENT-` layer, a step on `event:<name>`, once per run (A step on the ground) |
| "the shutter rolls up" | `animate-layers` on the shutter's layer (A door that slides open) |
| "it says ... when you look" | the `look` map, or the catalog's `look` for an item |
| "talking to him ..." | a step on `talk:<group>` (Talking brings friends) |
| "the gate is back" | `reset` with `break:<name>` (Story flags, and putting things back) |
| "starts over" | `"reset": "level"`, with `"svg": "fade-out"` |
| "every time" | the step in every state where it can happen |
| "only the first time" | the step in one state; the others under **Nothing on purpose** |
| "a friendly shopkeeper", "a box to keep things in" | planned: say so, offer the nearest built pattern |

## What to ask

At most three questions at a time, each one the user can answer in a line. Ask only
what neither the request nor the art answers. Always ask, when it is not said:

1. **The second time.** "When the player walks out of the shop again, should the
   crew come again, or nobody?" A level is predictable only once every repeat is
   decided; the check's commonest gap is a step that was written for one state and
   not the next.
2. **The end.** "When is the level over: after the back room, or does it start over?"
   A state the player cannot leave without meaning to is a dead end.

Good questions name the thing and offer the likely answers. Poor ones ask for the
format ("which state should that be?").

## Writing it well

- One beat per line, starting with what the player does or what becomes true:
  "When / Once / Every time ..., ... happens".
- Say **first time** or **every time**. Unsaid, it gets asked.
- Name things by what the player sees ("the shop door", "the key on the counter").
  The skill matches them to layer names, and lists any it cannot match.
- Give counts and order ("three, one by one", "four at once from both sides").
- Say how the level ends or starts over.
- No coordinates or sizes: where things are belongs to the art.
- Leave out what is not wanted. Every default the skill picks is listed under "Built
  as" and in its report, so none is hidden.

## Nothing on purpose

The check reads this section. Each bullet names, in backticks, the trigger and the
state it does nothing in, then says why:

```markdown
- `exit:corner-shop` in `ambush`: they are already waiting; going in and out again brings no one new.
- `crew-returns`: cannot happen in this level, since the shop stays locked until its crew is beaten.
```

A trigger with no state means every state; a state alone means it is meant to be
left behind (never entered) or to end the level. A bullet can wrap onto indented
lines.

## Built as

Filled by the skill, one row per beat:

```markdown
| Beat | State | Step or rule |
| --- | --- | --- |
| B2 | `gang-arrives` | `arrive` on `break:front-grille`; `spawn` `alley-gang` from the shop door |
```

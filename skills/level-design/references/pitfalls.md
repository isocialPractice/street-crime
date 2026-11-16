# Level design pitfalls

What went wrong in this repository's levels before, why, and how to see it coming.
"The matrix" is `node scripts/checkLevelDesign.js <level> --matrix`.

## A step in one state only

**What happens.** theStreets' response crew came the first time the player walked out
of the warehouse and never again: the state it led to had no step for walking out.

**Why.** A step on an event counts only while its state is current. An event heard in
any other state is not kept for later.

**Fix.** Give the state a step leads to the same step when the player can do the same
thing there, or list it under the brief's **Nothing on purpose**. The matrix reports
it as `does nothing, but in <state> it led here`.

## Two moments for "beaten"

**What happened.** A door opened as the last enemy fell (its case followed
`alive = 0`), but the state change waited on `defeated:<group>`, which once waited for
the body to fade. Going in at once, the way out was heard in the old state.

**Now.** `defeated:<group>` is reported as the last member falls, the moment `alive`
says nobody is left, and a state with `"svg": "fade-out"` clears the bodies while the
screen is black. Keep a lock and the step that goes with it on the same moment: the
matrix notes a locked door that opens in one state while only the next state has a
step for it.

## Once per run, or every time

| Reported | Kinds |
| --- | --- |
| once per run | `break:`, `event:`, `animate:`, `state:`, `arrive:`, and `spawn:`, `defeated:`, `fled:` until the group starts again |
| each time it becomes true again | `case:` (turning false lets it be reported again), `unlock:` and `lock:` (each after the other) |
| every time | `enter:`, `exit:`, `interact:`, `locked:`, `take:`, `use:`, `drop:`, `combine:`, `look:`, `talk:` |

A step waiting on a once-per-run report that already went out waits for ever, unless a
`reset` lets it go out again (`reset` with `break:<name>` mends the piece too). A
checklist row on `state:<name>` ticks once, however often the state is entered.

## The street stops while the player is inside

Enemies out in the street are not moved while the player is in a building: nobody
there is beaten, runs off or heals until the player comes out. A crew from
`"from": "edges"` comes in at the edges of the scene the player is in when the state
starts, so a state entered on `take:` inside a building brings the crew inside.

## A crew inside a building is lost when the player walks out

**What happens.** Only the street keeps its enemies while the player is elsewhere.
Walking out of a building drops whoever was fighting in there, and the interior is
empty the next time in. The crew's group still counts them, so `defeated:<group>`
never comes and `alive:<group>` never reaches 0, while plain `alive` (enemies in
play) drops at once, which can open a lock that follows it.

**Fix.** Give walking out a step to a state that waits, and walking back in a step
that brings the crew again with `"inherit": true`; `inherit` finds them on the
group's list, with the health they had. The pattern "Ambush when you take it" is
written that way. The action matrix reports a design without it as
`can get stuck: after walking out of <building> while <group> were in there`.

## A lock that should close again

A case that follows a condition keeps following it in every later state, until a
state's `set` gives it a value. A state that mends a gate and should lock the
warehouse again until a new crew is beaten sets the lock's case (`enemies-defeated`)
to `false`; without that the warehouse stays open, does nothing, and the matrix
reports no gap. Read each state's
`Doors:` line in the matrix against the brief's **Places**.

## Starting a group again while it stands

Re-entering a state starts its spawns again. Members of the group still standing are
then not counted by the group's `defeated:` or `alive:<group>`, though `alive` (every
enemy) still counts them. Send the level on to another state while a crew stands, or
give the repeat to a state that only comes once they are down.

## `when` reads cases only

To branch on an item, make a case follow it: `"has-key": { "condition": "inventory:key" }`,
then `"when": { "has-key": true }`. The first step that fires wins, so the one with
`when` goes before the general one.

## A case that is true too soon

A case following `alive = 0` from the top of the file is true before any crew has
come, so a lock that follows it is open at the start. Start the case `false` and take
the condition up in the state that brings the crew (a state's `cases`), as theStreets
does. `set` lets go of a condition; a state's `cases` takes it up again.

## Locks that stay open

A `restricted` entry without `"type": "condition"`, and a door opened by `REQUIRE-`
layers, stay open for the rest of the run. A `RESTRICTED-` layer with no `REQUIRE-`
layer gets a level map warning saying it stays locked unless the design names a
condition: that is expected when the design has a `restricted` entry for it.

## Rows that cannot happen

A design can hold states that this level can never reach (theStreets' `crew-returns`,
since its warehouse stays locked until the crew inside is beaten). The matrix reports
them as never entered. Keep them only on purpose, and say why under
**Nothing on purpose**.

## Drafts are for people

A file without `"version": 1` is read as a draft, converted with a note for every
change, and its wrong layer paths corrected to the nearest real ones. A version 1
file only gets suggestions. Always write version 1.

## Layer paths

`RESTRICTED-import-export-warehouse/ENTER-building` names the door whose nearest named
parent is that building; a path tells two doors of one name apart. Illustrator's `-2`
copies match their base name. `--layers` prints the shortest path that names each
door, breakable, item and trigger area alone.

## What is not built yet

- Interiors are built without the layers a design moves, so `animate-layers` cannot
  move a layer inside a building.
- The item catalog is the sandbox's, `config/debug/items.json`: an item a level uses
  must be in it until each level has its own.
- `"spawn": "left"` brings the player on at the level's left edge, which suits the
  start or a handover more than a fade in the middle (ROADMAP open decision 3).
- Friendly and neutral characters, item storage and every-time trigger areas are
  planned (see the end of `patterns.md`).

## Reading the matrix

| It says | It means |
| --- | --- |
| `does nothing, but in <state> it led here` | the step is in one state only (the first pitfall) |
| `can get stuck: ...` | some way into the state leaves none of its steps able to fire again |
| `has steps, but none of them can fire` | no way on at all |
| `never entered`, `never fires` | a state or step the level cannot reach, with the reason |
| `(locked at times)` | the door's lock follows a case that changes during the state |
| `Doors: ... open at times` | the same, door by door, as seen from the street |
| `Cannot here: ... (why)` | an action the player cannot take in that state, and why |
| a note | worth reading, not a gap: a door that opens before the state with its step, or a state that ends the level |

## Timing is not in the check

The matrix works from the files: bodies falling, fades, `after` and `every` are not in
it. Play the level in SANDBOX TEST, early and late: going into a building the moment
a fight ends, and doing each thing twice.

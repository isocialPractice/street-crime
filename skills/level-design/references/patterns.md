# Level design patterns

Techniques from classic survival-horror and adventure games, written as this engine
builds them. Each pattern is a technique, never a copy of any one game's rooms,
puzzles or people.

Every pattern gives what a brief says, the layers the art needs, a design, and what
happens the **second time**: a level is only predictable once that is decided. The
designs are complete version 1 files for a small made-up street
(`scripts/lib/patternFixture.js`), with these layers:

| Layer | Holds |
| --- | --- |
| `ENTERABLE-corner-shop` | its `ENTER-building`, and `shop-shutter`, a layer that can slide. Inside: the key on `OBJECT-counter`, the batteries on `OBJECT-shelf` |
| `RESTRICTED-back-room` | its `ENTER-building`; locked until the design opens it. Inside: the flashlight on `OBJECT-workbench` |
| `RESTRICTED-storeroom` | an empty `REQUIRE-item-key` and its `ENTER-building`. Inside: `OBJECT-safe`, and a bandage on `OBJECT-locker` |
| `OBJECT-front-grille` | `BREAKABLE-front-grille` |
| `OBJECT-newsstand` | nothing: an interact area |
| `EVENT-alley-mouth` | a trigger area |
| `OBJECT-bench` | `INVENTORY-whistle` |

`node scripts/checkLevelDesignVocab.js` checks every design here against that street
with the code SANDBOX TEST runs: no warnings, and no gaps in the action matrix but
the ones marked as meant. The items are the sandbox catalog's
(`config/debug/items.json`), so each design can be tried as written.

Status is **built** (the engine does it today) or **planned** (named so nobody draws
art for it; the TODO item is given). Never stand a planned pattern in with a built
one that looks similar: say it is planned.

## Places: where the player can and cannot go

### Key and locked door

**Technique.** A door that needs something found somewhere else first.

**Brief.** "The storeroom opens once the key from the corner shop is carried."

**Art.** `RESTRICTED-storeroom` holding an empty `REQUIRE-item-key` layer and its
`ENTER-building`. `INVENTORY-key` inside an `OBJECT-` layer in the corner shop.

**Design.** The `REQUIRE-` layer is the lock; the design only says what finding the
room does.

<!-- checked; meant: `enter:storeroom` in `storeroom-found`: the room is found once; going in again changes nothing -->
```json
{
  "version": 1,
  "start": "street",
  "states": {
    "street": {
      "svg": "loads",
      "player": { "spawn": "left", "inventory": "empty", "health": "full" },
      "next": [{ "on": "enter:storeroom", "to": "storeroom-found" }]
    },
    "storeroom-found": { "svg": "none" }
  }
}
```

**Second time.** Opened by its `REQUIRE-` layer, the door stays open for the run, even
once the key is gone. **Built.**

### A lock the design holds

**Technique.** The same door, but locked again when the key goes: the lock follows
what is carried.

**Brief.** "The back room is open only while the key is carried."

**Art.** `RESTRICTED-back-room` with its `ENTER-building`; no `REQUIRE-` layer (the
level map warns that it stays locked unless the design names a condition, which this
one does).

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "cases": { "has-key": { "condition": "inventory:key" } },
  "restricted": { "back-room": { "until": "case:has-key", "type": "condition" } },
  "states": {
    "street": { "svg": "loads", "player": { "spawn": "left", "inventory": "empty", "health": "full" } }
  }
}
```

**Second time.** `"type": "condition"` locks it again whenever the case stops holding,
reporting `lock:back-room`; without it, the door stays open once opened. **Built.**

### The room clears

**Technique.** The way on opens when every enemy is down.

**Brief.** "Breaking the front grille brings two of the alley gang out of the shop;
the back room opens when both are beaten."

**Art.** `BREAKABLE-front-grille` inside `OBJECT-front-grille`; the shop's
`ENTER-building`; `RESTRICTED-back-room`.

**Design.** The case follows `alive = 0` from the state that brings the gang, so it is
never true for a moment before they arrive.

<!-- checked -->
```json
{
  "version": 1,
  "start": "quiet",
  "cases": { "street-clear": false },
  "restricted": { "back-room": { "until": "case:street-clear", "type": "condition" } },
  "states": {
    "quiet": {
      "svg": "loads",
      "next": [{ "on": "break:front-grille", "to": "gang-out" }]
    },
    "gang-out": {
      "svg": "none",
      "cases": { "street-clear": { "condition": "alive = 0" } },
      "spawn": [{
        "group": "alley-gang", "type": "enemy", "count": 2, "pick": "random",
        "pool": ["CrimeGuy", "JumpingJunkie"], "from": "ENTERABLE-corner-shop/ENTER-building", "every": 0.8
      }]
    }
  }
}
```

**Second time.** The grille breaks once (it is reported once per run); the door opens
as the last of them falls, the same moment `defeated:alley-gang` is reported. **Built.**

### Locks behind you while they stand

**Technique.** The way back shuts while a fight is on.

**Brief.** "Coming out of the back room, two toughs are waiting; the back room is
locked until they are beaten."

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "cases": { "nobody-left": { "condition": "alive = 0" } },
  "restricted": { "back-room": { "until": "case:nobody-left", "type": "condition" } },
  "states": {
    "street": {
      "svg": "loads",
      "next": [{ "on": "exit:back-room", "to": "waiting-outside" }]
    },
    "waiting-outside": {
      "svg": "none",
      "spawn": [{ "group": "street-toughs", "type": "enemy", "count": 2, "pool": ["CrimeGuy"], "from": "edges", "order": "load" }],
      "next": [{ "on": "defeated:street-toughs", "to": "street-again" }]
    },
    "street-again": { "svg": "none" }
  }
}
```

**Second time.** Once they are beaten, walking out again brings nobody: `street-again`
has no step. Give it `{ "on": "exit:back-room", "to": "waiting-outside" }` for a
crew every time. **Built.**

### A step on the ground

**Technique.** Walking over a spot starts something (an adventure game's trigger
line).

**Brief.** "Walking into the alley mouth brings two of the gang from both sides."

**Art.** `EVENT-alley-mouth`: a shape on the ground, any fill.

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "states": {
    "street": {
      "svg": "loads",
      "next": [{ "on": "event:alley-mouth", "to": "alley-noticed" }]
    },
    "alley-noticed": {
      "svg": "none",
      "spawn": [{ "group": "alley-gang", "type": "enemy", "count": 2, "pool": ["JumpingJunkie"], "from": "edges", "order": "load" }]
    }
  }
}
```

**Second time.** `event:` is reported once per run, so crossing again does nothing.
**Built**; a trigger that fires every time is **planned**.

### A door that slides open

**Technique.** The art changes as the story moves: a shutter rolls up, a gate swings.

**Brief.** "When the grille breaks, the shop's shutter rolls up."

**Art.** Any layer by its name, here `shop-shutter`. Not inside a `BREAKABLE-`,
`ANIMATE-` or `INVENTORY-` layer, and not inside another layer that moves.

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "states": {
    "street": { "svg": "loads", "next": [{ "on": "break:front-grille", "to": "shutter-up" }] },
    "shutter-up": {
      "svg": "layer-state-change",
      "animate-layers": [{ "layer": "shop-shutter", "position-y": -150, "type": "ease-out", "duration": 0.5 }]
    }
  }
}
```

**Second time.** A layer sent where it already is stays put; `reset` with
`animate:shop-shutter` puts it back. Layers inside an interior cannot move yet.
**Built.**

### Rooms behind doors

**Technique.** A building to walk into.

**Art.** `ENTERABLE-<name>` (open) or `RESTRICTED-<name>` (locked at first), holding an
`ENTER-building` door; the interior is `enterables/<name>.svg` (or its camelCase name)
in the level folder. Inside, the player leaves by an `ENTER-exit` door or the left
edge. A design needs nothing for this; `enter:<name>` and `exit:<name>` are reported
every time. **Built**; rooms inside rooms are **planned** (ROADMAP open decision 4).

## People: who comes, when, and how

### Out of a door, one by one

**Technique.** A staggered entrance, so each arrival reads.

**Brief.** "Three come out of the shop, one each of a CrimeGuy, a JumpingJunkie and a
CrimeGuy in a gray vest, in random order, under a second apart."

**Design.** The crew is defined once under `groups`, so any state can bring it. A pool
entry with `render` recolors parts of an enemy by their layer names.

<!-- checked -->
```json
{
  "version": 1,
  "start": "quiet",
  "groups": {
    "enemy": {
      "alley-gang": {
        "count": 3, "pick": "random", "order": "random", "every": 0.8,
        "pool": [
          "CrimeGuy",
          "JumpingJunkie",
          { "enemy": "CrimeGuy", "name": "gray-crimeguy", "render": { "left-vest": "gray", "right-vest": "gray" } }
        ]
      }
    }
  },
  "states": {
    "quiet": { "svg": "loads", "next": [{ "on": "break:front-grille", "to": "gang-out" }] },
    "gang-out": {
      "svg": "none",
      "spawn": [{ "group": "alley-gang", "type": "enemy", "from": "ENTERABLE-corner-shop/ENTER-building", "animation": "walk", "after": 0.5 }],
      "next": [{ "on": "defeated:alley-gang", "to": "quiet-again" }]
    },
    "quiet-again": { "svg": "none" }
  }
}
```

**Second time.** The grille breaks once, so the gang comes once. **Built**; other stats
for a recolored enemy are **planned**.

### Ambush on the way out, every time

**Technique.** Enemies waiting when you leave a room.

**Brief.** "Every time the player walks out of the shop, two toughs close in from both
sides, until those are beaten; then the next time out brings two more."

<!-- checked; meant: `exit:corner-shop` in `ambush`: they are already waiting; going in and out again brings no one new -->
```json
{
  "version": 1,
  "start": "street",
  "groups": {
    "enemy": { "street-toughs": { "count": 2, "pool": ["CrimeGuy", "JumpingJunkie"], "from": "edges", "order": "load" } }
  },
  "states": {
    "street": { "svg": "loads", "next": [{ "on": "exit:corner-shop", "to": "ambush" }] },
    "ambush": {
      "svg": "none",
      "spawn": [{ "group": "street-toughs", "type": "enemy" }],
      "next": [{ "on": "defeated:street-toughs", "to": "street" }]
    }
  }
}
```

**Second time.** Decided by where the step is: `street` has it, so every way out
while the street is quiet brings a crew. **Built.**

### Ambush when you take it

**Technique.** Taking the thing you came for brings trouble.

**Brief.** "Taking the key from the counter brings two guards into the shop. Walked
out on, they wait inside, and close in again, as hurt as they were, the next time
the player comes in."

**Design.** `"from": "edges"` brings them in at the edges of the scene the player is
in when the state starts: here, inside the shop. A crew inside a building is lost
when the player walks out on it (gone, but still counted, so `defeated:` would never
come), so walking out goes to a state that waits, and coming back in brings them
again with `"inherit": true`. Without those two steps the level can get stuck, and
the action matrix says so.

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "groups": {
    "enemy": { "shop-guards": { "count": 2, "pool": ["CrimeGuy"], "from": "edges", "order": "load" } }
  },
  "states": {
    "street": { "svg": "loads", "next": [{ "on": "take:key", "to": "caught" }] },
    "caught": {
      "svg": "none",
      "spawn": [{ "group": "shop-guards", "type": "enemy" }],
      "next": [
        { "on": "defeated:shop-guards", "to": "got-away" },
        { "on": "exit:corner-shop", "to": "guards-waiting" }
      ]
    },
    "guards-waiting": { "svg": "none", "next": [{ "on": "enter:corner-shop", "to": "caught-again" }] },
    "caught-again": {
      "svg": "none",
      "spawn": [{ "group": "shop-guards", "type": "enemy", "inherit": true }],
      "next": [
        { "on": "defeated:shop-guards", "to": "got-away" },
        { "on": "exit:corner-shop", "to": "guards-waiting" }
      ]
    },
    "got-away": { "svg": "none" }
  }
}
```

**Second time.** The key is taken once and stays taken; every walk out and back in
brings back whoever still stands. **Built**, and played in SANDBOX TEST
(`design-11-skill`); keeping a building's crew when the player walks out is
**planned** ("Keep a building's enemies when the player walks out" in `TODO.md`).

### They remember

**Technique.** The ones you ran from are still there, as hurt as you left them.

**Brief.** "Hiding in the shop from the gang, they wait outside; coming out, the ones
still standing close in again with the health they had."

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "groups": {
    "enemy": { "alley-gang": { "count": 3, "pool": ["CrimeGuy", "JumpingJunkie"] } }
  },
  "states": {
    "street": {
      "svg": "loads",
      "spawn": [{ "group": "alley-gang", "type": "enemy", "from": "edges", "order": "load" }],
      "next": [
        { "on": "enter:corner-shop", "to": "hiding" },
        { "on": "defeated:alley-gang", "to": "clear" }
      ]
    },
    "hiding": { "svg": "none", "next": [{ "on": "exit:corner-shop", "to": "back-out" }] },
    "back-out": {
      "svg": "none",
      "spawn": [{ "group": "alley-gang", "type": "enemy", "from": "edges", "inherit": true }],
      "next": [
        { "on": "enter:corner-shop", "to": "hiding" },
        { "on": "defeated:alley-gang", "to": "clear" }
      ]
    },
    "clear": { "svg": "none" }
  }
}
```

**Second time.** Every hiding and coming out brings back whoever still stands. The
street does not move while the player is inside, so nobody heals or leaves. **Built.**

### A look and a run

**Technique.** A scout who checks on you and leaves.

**Brief.** "Every time the player comes out of the shop, a lookout comes, looks, and
runs off."

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "states": {
    "street": { "svg": "loads", "next": [{ "on": "exit:corner-shop", "to": "lookout" }] },
    "lookout": {
      "svg": "none",
      "spawn": [{ "group": "lookout", "type": "enemy", "count": 1, "pool": ["JumpingJunkie"], "from": "edges", "then": "flee" }],
      "next": [{ "on": "exit:corner-shop", "to": "lookout" }]
    }
  }
}
```

**Second time.** `lookout` has the step too, so every way out brings one: re-entering
a state starts its spawn again. `fled:lookout` is reported once they are gone. **Built.**

### Talking brings friends

**Technique.** What you say changes what happens (an adventure game's TALK).

**Brief.** "A loudmouth stands in the street. Talking to him brings two friends; the
street is quiet once everyone is down."

**Design.** A step with `when` and no `on` fires as soon as its cases hold.

<!-- checked; meant: `talk:loudmouth` in `friends-called`: his friends are already here; talking again changes nothing -->
```json
{
  "version": 1,
  "start": "street",
  "cases": { "all-down": { "condition": "alive = 0" } },
  "states": {
    "street": {
      "svg": "loads",
      "spawn": [{ "group": "loudmouth", "type": "enemy", "count": 1, "pool": ["CrimeGuy"], "from": "edges" }],
      "next": [
        { "on": "talk:loudmouth", "to": "friends-called" },
        { "on": "defeated:loudmouth", "to": "quiet" }
      ]
    },
    "friends-called": {
      "svg": "none",
      "spawn": [{ "group": "friends", "type": "enemy", "count": 2, "pool": ["JumpingJunkie"], "from": "edges", "order": "load" }],
      "next": [{ "when": { "all-down": true }, "to": "quiet" }]
    },
    "quiet": { "svg": "none" }
  }
}
```

**Second time.** Talking is reported every time; only the state it is heard in decides.
**Built**; someone who talks and never fights is **planned**.

## Things: what the player can carry

### Something glints on the floor

**Art.** `INVENTORY-<item>` inside an `OBJECT-` layer. A layer with art draws as itself;
an empty one draws the catalog's art. The item must be in the catalog: today that is
the sandbox's, `config/debug/items.json`. Taking it is `take:<item>`, reported every
time something is taken, and an item stays taken for the run. **Built.**

### It decides the ending

**Technique.** What you carry out of a place decides what happens next. Here the
flashlight (back room) and its batteries (shop) are put together on the item screen.

**Brief.** "Walking out of the back room with the flashlight lit finds the way out and
starts the level over; walking out without it, nothing happens until it is lit."

**Design.** `when` reads cases, so the item becomes a case that follows
`inventory:flashlight-lit`.

<!-- checked; meant: `exit:back-room` in `still-dark`: until the light is made, walking out again changes nothing -->
```json
{
  "version": 1,
  "start": "street",
  "cases": { "lit": { "condition": "inventory:flashlight-lit" } },
  "restricted": { "back-room": { "until": "state:street" } },
  "states": {
    "street": {
      "svg": "loads",
      "next": [
        { "on": "exit:back-room", "when": { "lit": true }, "to": "found-the-way" },
        { "on": "exit:back-room", "to": "still-dark" }
      ]
    },
    "still-dark": {
      "svg": "none",
      "next": [{ "on": "exit:back-room", "when": { "lit": true }, "to": "found-the-way" }]
    },
    "found-the-way": { "svg": "fade-out", "reset": "level" }
  }
}
```

**Second time.** The first step that fires wins, so the one with `when` goes first.
**Built.**

### Use it now

**Technique.** An item that does something when used: heal, scatter a crew, say a line.
It is the catalog that says so, not the design:

<!-- not checked: a catalog entry (config/debug/items.json), not a level design -->
```json
"bandage": { "name": "Bandage", "art": "items/bandage.svg", "stack": 3, "look": "A clean roll of bandage.", "use": { "heal": 25 }, "consume": true }
```

A design can wait on `use:<item>` like any event. **Built** (`heal`, `scatter`, `say`).

### Room in your pockets

The catalog's `slots` (8 in the sandbox's) and each item's `stack`. **Built**; item
storage between rooms is **planned** ("Item storage" in `TODO.md`).

## Words and story

### LOOK at anything

**Technique.** A line for everything the player looks at (an adventure game's LOOK).

<!-- checked -->
```json
{
  "version": 1,
  "start": "street",
  "look": {
    "newsstand": "Yesterday's paper. The headline is about the corner shop.",
    "front-grille": "Rusted through at the bottom.",
    "corner-shop": "The lights are on. Nobody is at the counter."
  },
  "states": { "street": { "svg": "loads" } }
}
```

`look` keys are `OBJECT-`, `BREAKABLE-`, `ENTERABLE-` or `RESTRICTED-` names; an item's
own line is its catalog `look`. A step can wait on `look:<name>`. **Built.**

### Story flags, and putting things back

**Technique.** The level remembers what happened, and can undo it.

**Brief.** "Once the grille is down, the next time the player comes out of the shop it
is whole again, and can be broken again."

<!-- checked; meant: `exit:corner-shop` in `grille-mended`: the grille is back; walking out again leaves it be -->
```json
{
  "version": 1,
  "start": "street",
  "cases": { "grille-whole": true },
  "states": {
    "street": { "svg": "loads", "next": [{ "on": "break:front-grille", "to": "grille-down" }] },
    "grille-down": {
      "svg": "none",
      "set": { "grille-whole": false },
      "next": [{ "on": "exit:corner-shop", "to": "grille-mended" }]
    },
    "grille-mended": {
      "svg": "none",
      "reset": ["break:front-grille"],
      "set": { "grille-whole": true },
      "next": [{ "on": "break:front-grille", "to": "grille-down" }]
    }
  }
}
```

**Second time.** `reset` makes the grille whole and lets `break:front-grille` be
reported again. **Built.**

### No dead ends

**Technique.** There is always a way on, or a way to start over: never a state the
player cannot leave without meaning to end there. `"reset": "level"` (with
`"svg": "fade-out"`) starts over, as in "It decides the ending". The action matrix
reports a state whose steps can never fire as "no way on", and a state with no `next`
as the end of the level. **Built.**

## Planned

Named so nobody builds art for them without knowing. Offer the nearest built pattern.

| Pattern | Nearest built | `TODO.md` |
| --- | --- | --- |
| Someone who will not fight: a shopkeeper who talks, a bystander who flees | a crew with `"then": "flee"`; `look` lines | Friendly and neutral characters in a design |
| A box for the rest: storage shared between rooms | the catalog's `slots` | Item storage |
| A level's own items | the sandbox catalog | Each level's own item catalog |
| A map of which doors are open | `lock:` and `unlock:` in the checklist | FILE and MAP pages on the item screen |
| A spent key that frees its slot | `consume` on a used item | Leave a spent key behind |
| Weapons to pick up and hold | | Weapons, held and equipped |
| Layers shown and hidden by the design | `animate-layers`, moving a layer out of view | `svg` actions that show and hide layers by path |
| A trigger area that fires every time | `EVENT-` (once per run) | |
| Rooms inside rooms | one interior per building | ROADMAP open decision 4 |
| Points for doing things; a narrator's line when a state starts | | |

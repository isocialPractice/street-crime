# Items and Inventory

Items lie in a level, where its layers put them. The player takes them, carries
them, and uses or combines them on the item screen, and can type commands such as
LOOK and TALK on a command line. A level design reads what the player carries and
waits on what they do, the way it waits on a gate breaking.

Items are data: a catalog lists them by id, with their name, their art, what
checking them says, and what using or combining them does.

## How to, in short

1. **Take an item:** walk to it until `E: CHECK` shows over the player, press **E**,
   and choose **YES**.
2. **Open your items:** **I** or **Tab**. The game stops while the screen is open.
3. **Use one:** move with the arrows or WASD, press **E** on the item, then **USE**,
   **CHECK** or **COMBINE**. **Esc** goes back a step.
4. **Combine two:** **COMBINE** on the first, then **E** on the second.
5. **Type a command:** **Ctrl+I**, then `look`, `talk`, `use crowbar` or
   `take crowbar`, and **Enter**.
6. **In SANDBOX TEST:** the panel's ITEMS block gives (**GIVE**), uses (**USE**)
   or puts down (**DROP**) any item in the catalog.

## The item catalog

A catalog is a JSON file, described by `config/schema/items.schema.json`. A sandbox
test names one with `"items"` ([sandbox.md](sandbox.md)); the sandbox's own is
`config/debug/items.json`, with its art in `config/debug/items/`. Catalogs for real
levels come with loading levels from `config/levels.json`, which is **planned**.

```json
{
  "$schema": "../schema/items.schema.json",
  "slots": 8,
  "items": {
    "crowbar":   { "name": "Crowbar", "art": "items/crowbar.svg", "look": "A bent steel crowbar." },
    "coin":      { "name": "Coin", "art": "items/coin.svg", "stack": 99, "look": "A silver coin.",
                   "use": { "say": "You flip the coin. Heads." } },
    "bandage":   { "name": "Bandage", "art": "items/bandage.svg", "stack": 3, "use": { "heal": 25 }, "consume": true },
    "whistle":   { "name": "Whistle", "art": "items/whistle.svg", "use": { "scatter": 1 } },
    "lamp":      { "name": "Lamp", "art": "items/lamp.svg", "combine": { "oil": "lamp-lit" } },
    "oil":       { "name": "Oil", "art": "items/oil.svg" },
    "lamp-lit":  { "name": "Lamp (lit)", "art": "items/lamp-lit.svg" }
  }
}
```

| Key | Is |
| --- | --- |
| `slots` | how many slots the player has, default 8 |
| `items` | the items, by id: lower-case letters, digits and `-`. The id is what a layer, a condition and a report use |
| `name` | what the item is called on screen |
| `art` | its SVG, relative to the catalog file: drawn lying in the level, in its slot, and turning when checked |
| `look` | what checking it, or LOOK at it, says |
| `stack` | how many share one slot, default 1 |
| `use` | what USE does, one of the actions below. Without one, USE says there is nothing to use it on here |
| `consume` | `true`: one is used up each time it is used |
| `combine` | another item's id to the id of what the two make. Both are used up and the result takes this item's slot. May be written on one side or both |

| `use` | Does |
| --- | --- |
| `{ "heal": 25 }` | restores that much health, up to full. At full health it says so and is not used |
| `{ "scatter": 1 }` | every enemy fighting in the scene runs off the nearer edge of the view, waits that many seconds, and walks back in at the same edge to take up the fight. They cannot be hit while they are away |
| `{ "say": "..." }` | only says that |

What is wrong with a catalog (an item with no name or no art, a `use` that is none
of these, a `combine` that names an item that is not there) is printed in the
console, and the sandbox's status line counts it as `items: N warnings`.

**Art.** Draw an item on a 64 by 64 artboard with no background, so it reads at 28
px lying in the level, 56 px in a slot and 220 px when checked. Black outlines suit
the characters. Name its parts the way a character's are, a part with `-light`,
`-mid` and `-dark` tone layers ([character-assets.md](character-assets.md#recoloring-parts)),
so a palette can recolor it later.

## Items in a level

An `INVENTORY-<item>` layer inside an `OBJECT-` layer puts an item where it is
([level-naming.md](level-naming.md#inventory-items-to-take)):

```text
OBJECT-tool-crate
  INVENTORY-crowbar     an empty rect where the crowbar lies, or the crowbar drawn in place
```

- `<item>` is an id from the catalog. A numbered copy (`INVENTORY-coin-2`) is the
  same item, so a level can scatter several.
- Art drawn inside the layer is cut out of the background and drawn as the item
  until it is taken. An empty layer (a rect with `fill="none"`) only marks the
  spot: the catalog's art stands there, bobbing, with a glint every two seconds.
- Standing at it shows `E: CHECK`, with the same reach as a door: the middle of the
  player over it and their feet near its bottom edge. A door comes first, then an
  item, then a plain object.
- An item taken stays taken for the run, in the street and in every building, so
  going out and back in never brings it back. A level design's `"reset": "level"`
  and RESTART do.
- Arriving next to an item never takes it: the player has to have been out of its
  reach once, as with a door.

## Taking an item

**E** at an item stops the game and opens a window at the bottom of the screen: the
item's art, what checking it says (typed out), and `Take the Crowbar?` with **YES**
and **NO**. Left and Right choose; **E**, **Enter**, **J** or **Space** confirm;
**Esc**, **K** or **Backspace** answer NO. A confirm key while the text is still
typing shows the rest at once.

YES puts it in the player's hands (`You took the Crowbar.`) and reports
`take:crowbar`. With no room, the window says `No room for the Crowbar.` and the item
stays where it is.

## Carrying

The player has as many slots as the catalog's `slots`. Each slot holds one item and
how many of it, up to its `stack`: three coins take one slot, two crowbars two.
Slots keep their order as things come and go.

A level design's `player` rules decide what happens to it on entering a state
([level-design.md](level-design.md#player)):

| `inventory` | Does |
| --- | --- |
| `empty` | empties it |
| `inherit` | keeps it |
| `store` | keeps it, and stores a copy for the next level |

A sandbox test's `"inventory"` gives the player items to start with, after the
design's start state, so a start state's `"inventory": "empty"` does not take them.

## The item screen

**I** or **Tab** opens it while playing, but not during a door's fade or while the
player is off stage or walking in. The game stops under it.

| Part | Shows |
| --- | --- |
| left | the player, their **condition** as a heartbeat trace and a word, and what they are **holding** (`FISTS` until there are weapons) |
| right | the slots, two across, with a stack's count in the corner |
| bottom | the item under the cursor: its name, and what checking it says, typed out |

| Key | Does |
| --- | --- |
| arrows, WASD | move the cursor |
| **E**, **Enter**, **J**, **Space** | on an item, open its commands; in a command list, do it |
| **Esc**, **K**, **Backspace** | back one step; from the slots, close the screen |
| **I**, **Tab** | close the screen from anywhere |

| Command | Does |
| --- | --- |
| **USE** | what the item's `use` does, said on the message line. An item that acts on the world (a `scatter`) closes the screen first, so what it does is seen. Reports `use:<item>` when it did something |
| **CHECK** | the item large, turning slowly; Left and Right turn it by hand |
| **COMBINE** | asks for a second item, the first one's slot blinking. A recipe on either side makes the result, in the first one's slot (`Combined: Lamp (lit).`), and reports `combine:<result>`. Otherwise: `They do not go together.` Picking the first item again cancels |

There is no drop: what is carried stays carried. The mouse works too: hovering
moves the cursor, a click on a slot opens its commands, a click on a command does
it, and a click outside the panel closes the screen.

**Condition.** The trace beats faster as health falls:

| Health | Word | Trace |
| --- | --- | --- |
| above two thirds | `FINE` | green, about 60 beats a minute |
| above one third | `CAUTION` | amber, about 90 |
| below | `DANGER`, blinking | red, about 130 |

With the system set to reduce motion, nothing slides or turns, the trace is drawn
still, and text appears whole.

## The command line

**Ctrl+I** opens a line across the bottom of the view; the game stops while it is
open. Type a command and press **Enter**. The answer appears in a box above the
line, with the command echoed; **Enter**, **Esc** or any action key closes it, and
the game goes on.

| Key | Does |
| --- | --- |
| **Enter** | run the line; an empty line closes it |
| **Esc** | clear the line; on an empty line, close it |
| **Backspace** | delete the last letter |
| **Up**, **Down** | the lines already run, newest first |
| **Ctrl+I** | close |

| Verb | Also | Does |
| --- | --- | --- |
| `look` | `l`, `examine`, `x`, `check`, `inspect` | alone: what lies within 32 px of the player's feet (`There seems to be a door and a tool crate here.`), or `There seems to be ground here.`. With a word: that thing on screen, or an item carried |
| `talk` | `speak`, `ask`, `chat` | the nearest enemy within 160 px. One fighting: `They are done talking.` One running off or scattered: a rude line. Nobody: `There is nobody here to talk to.` |
| `use <item> [on <thing>]` | `apply` | the item's USE, as on the item screen |
| `take <item>` | `get`, `grab`, `pick up` | an item within 32 px, without asking |
| `inventory` | `inv`, `i`, `items` | the item screen |
| `help` | `?` | the verbs |

Words such as `the`, `a`, `at`, `to`, `with` and `around` are dropped, so `look at
the crate` is `look crate`. A verb the line does not know gets `You do not know how
to <verb>.` LOOK's 32 px is measured to each thing's box; a door's or an object's
box reaches down to the ground below it, since the art draws it on a wall.

The line is typed straight into the game rather than into a text field, so it has
no paste. In Firefox, Ctrl+I is also the shortcut for Page Info; the game asks the
browser not to open it.

### Names and the design's look

A thing is called by its layer name in words: `OBJECT-tool-crate` is "a tool crate",
`BREAKABLE-crate-stack` "a crate stack" (or "a broken crate stack"), and an enemy by
its art name, `CrimeGuy` "a crime guy". A door is "a door to the corner shop" when
it is inside `ENTERABLE-corner-shop`, and an interior's way out is "the way out".

A level design's top-level `look` gives LOOK a sentence instead, by layer name:

```json
"look": {
  "tool-crate": "A wooden crate. Someone pried the lid off.",
  "corner-shop": "A shop with its shutters half down."
}
```

A door uses its enterable's entry. Each name is checked against the level's
`OBJECT-`, `BREAKABLE-`, `ENTERABLE-`, `RESTRICTED-` and `INVENTORY-` layers.

## What a level design reads

| Written | Reads |
| --- | --- |
| `"has-crowbar": { "condition": "inventory:crowbar" }` | a case true while the player carries a crowbar |
| `{ "condition": "inventory:coin >= 3" }` | three coins or more |
| `{ "condition": "inventory = 0" }` | empty-handed |
| `"on": "take:crowbar"` | the player took one |
| `"on": "use:whistle"`, `"combine:lamp-lit"`, `"drop:coin"` | the player used, made or put one down |
| `"on": "look:tool-crate"`, `"look:ground"` | the player looked at it, or at nothing in particular |
| `"on": "talk:alley-gang"` | the player talked to a member of that group (or to an enemy by its id) |
| `REQUIRE-item-crowbar` inside a `RESTRICTED` | a door that unlocks while the player carries a crowbar |

The theStreets level uses the first to decide what happens when the player leaves
the warehouse ([level-design.md](level-design.md#a-complete-example)):

```json
"next": [
  { "on": "exit:import-export-warehouse", "when": { "has-key": true }, "to": "response-fights" },
  { "on": "exit:import-export-warehouse", "to": "response-flees" }
]
```

## Adding an item

1. Draw its art (see [The item catalog](#the-item-catalog)) and save it next to the
   catalog, such as `config/debug/items/crowbar.svg`.
2. Add it to the catalog: `"crowbar": { "name": "Crowbar", "art": "items/crowbar.svg", "look": "..." }`.
3. Place it: an `INVENTORY-crowbar` layer inside an `OBJECT-` layer, in the level SVG
   or an interior.
4. Read it in the level design: `{ "condition": "inventory:crowbar" }` or
   `"on": "take:crowbar"`.
5. Try it in SANDBOX TEST with the test's `"items"` naming the catalog. The ITEMS
   block can give it straight away, without walking to it.

## Settings

In debug mode's panel and `config/configuration.json`:

| Setting | Default | Is |
| --- | --- | --- |
| Text Speed (`textSpeed`) | 40 | characters a second for text that types itself out |
| Look Range (`lookRange`) | 32 | px from the player's feet that LOOK and TAKE reach |
| Talk Range (`talkRange`) | 160 | px TALK finds an enemy in |
| Stand Before Run (`enemyFleeDelay`) | 1.2 | seconds an enemy that flees stands first |
| Run Speed (`enemyFleeSpeed`) | 1.6 | how much faster than it walks an enemy runs off, also when scattered |

## Planned

- storing items somewhere to take later, as an item box
- weapons, and holding one
- `use <item> on <thing>` doing something, with `MISSING-` layers that wait for an item
- `USABLE-` (things carried in the hands, not in a slot) and `SWITCH-` layers
- each level's own catalog, loaded with the level

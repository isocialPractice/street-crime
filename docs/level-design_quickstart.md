# Level Design Quickstart

Make something happen in a level: when the crates break, two enemies come out of
the corner shop's door, and beating them clears the alley. About 15 minutes. This
carries on from the level in [level-naming_quickstart.md](level-naming_quickstart.md);
the full reference is [level-design.md](level-design.md).

## 1. Create the file

`config/levels/back-alley/level-design.json`:

```json
{
  "$schema": "../../schema/level-design.schema.json",
  "version": 1,
  "start": "quiet",
  "cases": { "alley-cleared": false },
  "states": {
    "quiet": {
      "next": [{ "on": "break:crate-stack", "to": "ambush" }]
    },
    "ambush": {
      "spawn": [{
        "group": "alley-gang",
        "type": "enemy",
        "count": 2,
        "from": "ENTERABLE-corner-shop/ENTER-building",
        "after": 0.5,
        "every": 1
      }],
      "next": [{ "on": "defeated:alley-gang", "to": "cleared" }]
    },
    "cleared": {
      "set": { "alley-cleared": true }
    }
  }
}
```

In VS Code the `$schema` line gives completion and hover help for every key.

## 2. Point the sandbox test at it

Add `"design"` to the `back-alley` test in `config/debug/sandbox.json`, and new
checklist rows:

```json
"design": "config/levels/back-alley/level-design.json",
"checklist": [
  { "label": "Break the crates", "event": "break:crate-stack" },
  { "label": "The gang comes out", "event": "spawn:alley-gang" },
  { "label": "Beat them", "event": "defeated:alley-gang" },
  { "label": "Alley cleared", "event": "case:alley-cleared" }
]
```

## 3. Try it

Start **SANDBOX TEST**. The status line ends in `design: 0 warnings`; anything
else is listed in the console, with a "did you mean" for misspelt names. With
**Show Hitboxes** on, the bottom-left box shows the current state and cases.

Break the crates: two enemies walk out of the shop door, one second apart. Beat
them and the last two rows tick.

## 4. Change it

- Walk the player in at the start: add to `quiet`
  `"player": { "spawn": "left", "after": 1, "animation": "walk" }`
- Lock the shop until the alley is clear: rename the layer to
  `RESTRICTED-corner-shop` (and the path in `"from"`), then add
  `"restricted": { "corner-shop": { "until": "case:alley-cleared" } }`
- Start the ambush from a place instead of the crates: draw an `EVENT-alley-ambush`
  area and use `"on": "event:alley-ambush"`
- Write the gang once and spawn it from any state: move its keys under
  `"groups": { "enemy": { "alley-gang": { ... } } }` and leave
  `{ "group": "alley-gang", "from": "..." }` in the state
- Open the shop only while nobody is left to fight: give a case a condition,
  `"nobody-left": { "condition": "alive = 0" }`, and write
  `"restricted": { "corner-shop": { "until": "case:nobody-left", "type": "condition" } }`
- Branch on what the player carries: lay a crowbar in the shop
  (`INVENTORY-crowbar`, [inventory.md](inventory.md)), add
  `"has-crowbar": { "condition": "inventory:crowbar" }`, and give a step
  `"when": { "has-crowbar": true }`

The full list of keys and triggers is in [level-design_cheatsheet.md](level-design_cheatsheet.md).

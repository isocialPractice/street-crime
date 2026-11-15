# The Streets

## The level

Art: `assets/levels/theStreets/level-theStreets.svg`, with the bar and the warehouse
as interiors in `enterables/`.
In one line: break into a warehouse whose crew comes out to stop you, and decide
with what you carry out of it how the next crew greets you.
The player starts: walking in from the left, two seconds after the level loads.

## Places

- The bar: always open.
- The warehouse: locked until nobody is left to beat; locked again while a crew
  stands outside it.

## People

- Warehouse crew: three, one each of a JumpingJunkie, a CrimeGuy and a CrimeGuy
  with his vest and legs in gray, in random order, out of the warehouse door one
  by one.
- Response crew: four, a JammingJabber, a BadGirl and two SassyGirls (one in dark
  gray), in from both edges of the view at once.

## Things

- Key: on the warehouse's second screen. Decides whether the response crew
  fights or runs.

## What happens

B1. The level starts: the player walks in from the left. The warehouse is locked.
B2. Breaking the parking gate arm: the warehouse door's glass and handles slide
    apart, and the warehouse crew walks out.
B3. The warehouse crew beaten: the warehouse opens, as the last one falls.
B4. Walking out of the warehouse with the key: the response crew comes in to
    fight, and the warehouse locks while they stand.
B5. Walking out without it: the response crew comes in, looks, and runs off.
B6. The response crew ran off, then leaving the bar: the gate is whole again and
    the warehouse locked; breaking the gate starts again from B2.
B7. Both crews beaten, then leaving the bar: the screen fades and the level
    starts over at B1.

## Again and again

- Walking out of the warehouse: every time, until the response crew has been
  fought (B4 with the key, B5 without).
- The key: taken once, and it stays taken for the run.
- The gate: breaks again every time B6 has mended it.

## Nothing on purpose

- `exit:import-export-warehouse` in `response-fights`: once the response crew
  has been fought, walking out of the warehouse again brings nobody.
- `exit:bad-bar` in `gate-reset`: the bar has done its part; the gate has to be
  broken again (B6).
- `crew-returns`: cannot happen in this level, since the warehouse stays locked
  until its crew is beaten, so that crew is always down by the time the response
  crew comes. Kept so the table of outcomes is whole; sandbox step 9
  (`design-9-conditions`) plays the same keys where it can happen.

## Test

SANDBOX TEST `level-design`: its checklist ticks each beat in order. Walking out
of the warehouse twice without the key, then with it, brings the crew each time
(running, running, fighting). `.tmp/response-check.js` plays that, and going in
while the last of the warehouse crew is still on the ground.

## Built as

| Beat | State | Step or rule |
| --- | --- | --- |
| B1 | `initial` | `player.spawn` `left`, `after` 2; `restricted` `import-export-warehouse` until `case:enemies-defeated` |
| B2 | `gate-breaks` | `initial` on `break:parking-gate-arm`; `spawn` `warehouse-crew`; `animate-layers` |
| B3 | `enemy-defeat` | `gate-breaks` on `defeated:warehouse-crew`; case `enemies-defeated` follows `alive = 0` |
| B4 | `response-fights` | on `exit:import-export-warehouse` when `has-key`, in `enemy-defeat` and `response-flees` |
| B5 | `response-flees` | on `exit:import-export-warehouse` otherwise, in the same two states; `then` `flee` |
| B6 | `gate-reset` | `response-flees` on `exit:bad-bar` when `warehouse-crew-down`; `reset` the gate; `set` `enemies-defeated` false |
| B7 | `replay` | `response-fights` on `exit:bad-bar` when both crews are down; `reset` `level` |

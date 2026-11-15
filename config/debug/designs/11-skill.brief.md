# Night Shift at the Docks

## The level

Art: `assets/levels/theStreets/level-theStreets.svg`, with the bar and the warehouse
as interiors in `enterables/`.
In one line: a night shift at the docks; break the gate to draw the bar's regulars
out, get into the warehouse, take the key and beat its guards, then walk out to end
the night.
The player starts: walking in from the left, one second after the level loads, with
nothing carried and full health.

## Places

- The bar: always open. Going in and out of it does nothing.
- The warehouse: locked until both regulars are beaten; then open for the rest of
  the night, until the night starts over.

## People

- Regulars: two, one CrimeGuy and one JumpingJunkie in random order, out of the
  bar's door one by one, a second apart, half a second after the gate breaks; they
  fight.
- Guards: two CrimeGuys in gray vests, in from both sides of the warehouse room at
  once; they fight. Walked out on, they wait inside, and close in again from both
  sides, with the health they had, the next time the player goes in.

## Things

- Key: on the crate on the warehouse's second screen. Taking it brings the guards.
  It is not needed to end the night.

## What happens

B1. The night starts: the player walks in from the left. The warehouse is locked.
B2. Breaking the parking gate arm: two regulars come out of the bar's door, one at
    a time.
B3. Both regulars beaten: the warehouse opens, as the last one falls.
B4. Taking the key in the warehouse: two guards come in from both sides of the
    room at once.
B5. Walking out of the warehouse while a guard stands: the guards wait inside;
    going back in, they close in again from both sides, as hurt as they were.
    Every time, until both are beaten.
B6. Both guards beaten, then walking out of the warehouse: the screen fades and
    the night starts over at B1, the gate whole, the key back on its crate and the
    warehouse locked.

## Again and again

- The gate: breaks once a night; it is whole again when the night starts over.
- The regulars: come once a night.
- Walking out of the warehouse before taking the key: nothing; going back in is
  just going back in.
- The key: taken once, and it stays taken until the night starts over. Dropping it
  and taking it again brings nobody new.
- Walking out while a guard stands: every time, the guards wait inside and close in
  again on the way back in (B5).
- Walking out once both guards are beaten: ends the night (B6), every night.
- The bar: going in and out does nothing, every time.

## Nothing on purpose

- `exit:import-export-warehouse` in `warehouse-open`: before the key is taken,
  walking out of the warehouse changes nothing.
- `enter:import-export-warehouse` in `warehouse-open`: the warehouse is open;
  going in changes nothing until the key is taken.
- `enter:bad-bar`: the bar is only a door; going in brings nobody.
- `exit:bad-bar`: the regulars come out of the bar once, when the gate breaks;
  walking out of it brings nobody.

## Test

SANDBOX TEST `design-11-skill`: its checklist ticks each beat in order. Try the
warehouse door before breaking the gate (E: LOCKED), then break the gate and beat
the two regulars by the bar. Go into the warehouse and walk out again before taking
the key: nothing happens. Take the key, hit one guard, walk out, then go back in:
both come back from the sides, the one hit still hurt. Beat both, walk out: the
screen fades and the night starts over, with the gate whole and the key back.

## Built as

| Beat | State | Step or rule |
| --- | --- | --- |
| B1 | `night-shift` | start; `player.spawn` `left`, `after` 1, `inventory` `empty`, `health` `full`; `restricted` `import-export-warehouse` until `case:regulars-down` (starts false) |
| B2 | `regulars-out` | `night-shift` on `break:parking-gate-arm`; `spawn` `regulars` from `ENTERABLE-bad-bar/ENTER-building`, `after` 0.5, `every` 1 |
| B3 | `warehouse-open` | case `regulars-down` follows `alive:regulars = 0` from `regulars-out`; `regulars-out` on `defeated:regulars` |
| B4 | `guards-in` | `warehouse-open` on `take:key`; `spawn` `guards` from `edges`, `order` `load` |
| B5 | `guards-waiting`, `guards-back` | `guards-in` and `guards-back` on `exit:import-export-warehouse` to `guards-waiting`; `guards-waiting` on `enter:import-export-warehouse` to `guards-back`, `spawn` `guards` with `inherit` |
| B6 | `guards-down`, `night-over` | `guards-in` and `guards-back` on `defeated:guards`; `guards-down` on `exit:import-export-warehouse`; `night-over` `svg` `fade-out`, `reset` `level` |

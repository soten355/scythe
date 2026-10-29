# Rules notes

Rulings the engine relies on, with their status. "Verify" means the owner
should check it against the rulebook; tick it once confirmed.

## Turn structure

- [ ] Verify: each turn you move to a different section of your player mat than
      on your previous turn. On your first turn, any section.
- [ ] Verify: you may take the top-row action, the bottom-row action, both, or
      neither, but top always comes before bottom.
- [ ] Verify: play passes clockwise; turn order is fixed for the game.
- Later: the starting player is set during setup (by player mat). Until mats
  exist, seat 1 goes first.
- Later: some faction abilities break the "different section" rule; these will
  be rule hooks on the faction, not changes to the core turn.

## Player mats and faction mats

- [x] Player mat gives: starting popularity, starting coins, objective cards
      drawn, and turn order (lowest number goes first). Source: rulebook
      setup, "Starting cards and track positions".
- [x] Faction mat gives: starting power and combat cards drawn (same source).
      The mat editor covers player mats only.
- [x] The Produce action's extra cost as workers grow is the same on every
      player mat, so it is a rule, not mat data. (Owner.)
- [x] Each section holds one structure under its top-row action. Building it
      reveals a bonus for that top-row action from then on: Monument +1
      popularity (Bolster), Armory +1 power (Trade), Mill counts as an extra
      hex to produce on (Produce), Mine is a tunnel only you can use (Move).
      Source: rulebook, Build. Stored per section so new mats can vary it.
- [x] Faction mat also holds: the faction ability, 4 mech abilities (each
      covered by a mech until deployed), 6 stars, and the 4 recruit one-time
      bonuses (2 power, 2 coins, 2 popularity, 2 combat cards). The
      character starts on the home base and one worker on each land hex
      next to it; those are board rules, not faction data. Source: rulebook
      setup.

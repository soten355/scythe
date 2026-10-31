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

## Combat

- [ ] Verify: characters and mechs may move onto other players' units;
      workers may not (unless carried by a mech). Fights happen once the
      whole move is over, in the order the attacker picks.
- [ ] Verify: moving onto enemy workers alone sends them home with no
      fight; the mover loses 1 popularity per worker.
- [ ] Verify: each side adds up to one combat card per character or mech it
      has in the fight and dials 0–7 power (no more than it has). Ties go to
      the attacker. Both pay the power dialed and discard the cards played.
- [ ] Verify: everything of the loser's on the hex goes home; if the
      attacker won, they lose 1 popularity per enemy worker sent home.
- [ ] Verify: the loser draws a combat card if they showed at least 1 power.
      The engine counts dial plus cards; it may be the dial only.
- [ ] Verify: a mech may carry workers into a fight; if it loses, they go
      home too.
- [ ] Verify: the winner places a combat star, at most two per game.
- [ ] Verify: the combat deck is 16 twos, 12 threes, 8 fours and 6 fives;
      when it runs out, the discards are shuffled into a new deck.

## Abilities

- [ ] Verify: movement mech abilities (Riverwalk, Seaworthy, Township,
      Speed) work for the character as well as the mechs.
- [ ] Verify: Riverwalk lets a unit cross a river only onto the listed
      terrains (it's the hex you move onto that counts).
- [ ] Verify: workers can't be on lakes, so a Seaworthy mech can't carry
      workers onto one; when a Seaworthy loser retreats onto a lake, its
      workers in the fight still go home. The loser picks one place for all
      its character and mechs there.
- [ ] Verify: Speed lets a unit move one more hex; moving onto any enemy
      unit ends its move. On the way it may drop off and pick up workers and
      resources (owner's play-test note).
- [ ] Verify: Township links any village you control with the Factory, both
      ways, for the character and mechs.
- [ ] Verify: Artillery is decided before anyone dials: the attacker first,
      then the defender. The other side can't drop below 0 power.
- [ ] Verify: People's Army's extra card needs a worker of yours on the
      fight's hex (for an attacker, one carried in by a mech counts).

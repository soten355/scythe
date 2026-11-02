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
- [x] A Seaworthy mech can carry workers and resources onto a lake, but
      there they never leave the mech: they can't be dropped off or move off
      alone, and the last mech to leave takes them along. A Seaworthy loser
      may retreat onto a lake next to the fight, taking its workers with it.
      (Owner.) The loser picks one place for all its units there.
- [ ] Verify: resources riding on a mech on a lake can still be spent on a
      bottom-row action (the engine allows it: you control the lake).
- [ ] Verify: Speed lets a unit move one more hex; moving onto any enemy
      unit ends its move. On the way it may drop off and pick up workers and
      resources (owner's play-test note).
- [x] Township links any village you control with the Factory, both ways,
      for the character and mechs only, not workers. (Owner, Nov 1, 2026:
      replaces the earlier workers-only ruling.)
- [ ] Verify: Artillery is decided before anyone dials: the attacker first,
      then the defender. The other side can't drop below 0 power.
- [ ] Verify: People's Army's extra card needs a worker of yours on the
      fight's hex (for an attacker, one carried in by a mech counts).

- [ ] Verify: Submerge (Polonia) moves the character and mechs onto and off
      lakes and from any lake to any other; it doesn't allow retreating onto
      a lake (Seaworthy does).
- [ ] Verify: Underpass (Saxony) is for the character and mechs (not
      workers), between any mountain you control and any tunnel, both ways;
      Saxony's own mine counts as a tunnel.
- [ ] Verify: Camaraderie (Polonia) also covers moving onto enemy workers
      alone, not only workers in a fight.
- [ ] Verify: Disarm (Saxony) works attacking or defending, happens on its
      own as the fight starts, and a Saxony mine counts as a tunnel.
- [ ] Verify: Scout (Crimea) happens on its own as the fight starts,
      attacking or defending, taking one card at random.
- [ ] Verify: Dominate (Saxony) lifts the two-star limit on combat stars
      (objectives later); the game still ends at the sixth star.

- [ ] Verify: Coercion (Crimea) can only stand in for resources paid on the
      bottom row (and later Factory cards), once per turn; the card goes to
      the discard pile.

- [ ] Verify: Wayfare (Crimea) moves the character and mechs (with any
      workers a mech carries) from any territory or home base to your own
      home base or one no faction uses. Resources can't be taken onto a home
      base. Units there aren't on a territory: they don't count for control
      or scoring, nobody fights there, and they move out to the hexes that
      border that base.
- [x] Fights can happen on a lake when Seaworthy or Submerge mechs meet
      there. (Owner.)

## Encounters

- [ ] Verify: only the character has encounters; mechs and workers move on
      and off encounter hexes freely.
- [ ] Verify: reaching an encounter hex ends the character's move (even
      with Speed); the encounter comes after the whole move and its fights,
      and only if the character won (or there was no fight).
- [ ] Verify: an option can only be taken if its whole cost can be paid;
      if none can, nothing is taken.
- [ ] Verify: workers and resources an encounter gives go on the
      encounter's hex; at most 8 workers in all.
- [x] A free Deploy or Build from an encounter follows the usual rules (on
      a hex with one of your workers). (Owner, Nov 1, 2026: to verify in the
      rulebook.)
- [ ] Verify: a free bottom-row action from an encounter pays no coins and
      triggers no recruit bonuses (yours or your neighbors'); a free Enlist
      still gives its one-time bonus.
- [ ] Verify: Meander takes up to two different options of the same card,
      paying for each.
- [ ] Verify: used cards are set aside; the engine shuffles them back into
      a new deck if the deck runs out (it never should with the full deck).

## The Factory

- [x] When the character ends its move on the Factory (and wins any fight
      there), the player looks at one card more than there are players and
      keeps one; one Factory card a game. (Owner, Nov 2, 2026.)
- [x] Reaching the Factory doesn't end the character's move (unlike an
      encounter): it only has to end the move there. (Owner.)
- [x] The card is a fifth section: top part "pay → gain", bottom part a
      Move; it can't be picked twice in a row. (Owner.)
- [ ] Verify: the cards not kept go back under the deck.
- [ ] Verify: the Factory card's Move gives no coins instead (unlike the
      mat's Move), and there's no bottom-row action after it.
- [ ] Verify: Speed adds to the Factory card's move for the character and
      mechs; the card's distance applies to workers too.
- [ ] Verify: Coercion can pay one resource of a Factory card's cost.
- [ ] Verify: free bottom-row actions from a Factory card give no coins and
      no recruit bonuses (as with encounters).

## Game end and scoring

- [ ] Verify: the game ends the moment a player places their sixth star,
      even partway through their turn (nothing more is done that turn).
- [ ] Verify: popularity tiers pay 3/2/1 (0-6), 4/3/2 (7-12) and 5/4/3
      (13-18) coins per star, per territory and per 2 resources.
- [ ] Verify: the Factory counts as three territories; lakes count as
      territories (for whoever controls one with a mech); home bases don't.
- [ ] Verify: resources count if they're on a hex you control.
- [ ] Verify: ties are broken by workers, mechs, structures and recruits
      together, then power, then popularity, then resources, territories
      and stars.
- [ ] Structure bonus tiles add to the score once they're entered (with
      the Factory and encounters).

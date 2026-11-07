# Scythe Digital — Design Document

Oct 26, 2026

## Overview and goals

We are building a personal, offline-first digital version of Scythe that plays on iPhone and in a Mac browser, starting clean and functional and built to grow. Every decision below follows from the goals in this table.

| Goal | What it means for the build |
| --- | --- |
| Play mostly against bots, sometimes pass-and-play | Every player is a pluggable "seat"; human and bot seats are interchangeable |
| Play a full game in one sitting, or pick at it over days | Autosave after every action; resume exactly where you left off |
| No cross-device sync, but load and save files | Export and import save files; no server required |
| Campaign mode later | Engine supports persistent state across games as an add-on module |
| Base game plus Invaders from Afar, open to more | Content lives in modules; expansions register on top of the core |
| Clean first, polish later (animation, sound, 3D) | Graphics are a separate layer that can be swapped without touching rules |
| Bots that play the real game, each with its faction's personality (no Automa; decided Nov 2, 2026) | Bots share one interface; a smarter AI drops into the same slot |

**Scope at launch:** base game (5 factions, 5 player mats), up to 5 players in any mix of humans and bots. Invaders from Afar (2 factions, 2 player mats, up to 7 players) comes later, in Phase 5 (moved Nov 2, 2026: the owner has no physical copy to enter it from).

**IP approach:** we rebuild the rules, which aren't copyrightable, and use original visuals and wording. The engine refers to content by neutral IDs; display names, art and flavor text live in a swappable content pack. Encounter and objective cards keep their mechanical effects, with original text.

## Platform decision

**Decision: a Progressive Web App (PWA).** You install it once from Safari with "Add to Home Screen." After that it launches full-screen, runs fully offline, and the same build runs in any browser on the Mac.

| Option | Strength | Why not (for now) |
| --- | --- | --- |
| **PWA** (chosen) | One codebase for iPhone and Mac; offline; no Apple developer account | No haptics on iOS; slightly less native feel |
| Native iOS (Swift) | Best feel and performance | Free installs expire every 7 days without a $99/yr account; no browser version; Intel Mac nearing the end of toolchain support |
| Game engine (Godot, Unity) | Strong for animation and 3D | Heavy web builds, clunky UI and text work, same iOS signing hassle |
| Hybrid (Capacitor wrap) | Native app built from the PWA's code | Not needed yet; kept as an upgrade path |

**Upgrade paths that stay open:**

- **3D:** Three.js renders a 3D board in the same app, replacing the 2D board view.
- **Native feel:** wrapping the PWA in Capacitor adds haptics and native storage, with no rewrite.

**Hosting:** the app is static files, deployed to GitHub Pages on every push to main. Once installed, the phone doesn't need the network.

## Architecture

The rules engine is the center of the project; the app, the players and the saves all plug into it through narrow interfaces.

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation (the app)                                      │
│ 2D board and player mats now; animation, sound and 3D later │
└─────────────────────────────────────────────────────────────┘
        │ your taps                          ▲ new state redraws the board
        ▼                                    │
┌──────────────────────────────────────┐     │
│ Seats                                │     │
│ Human · Pass-and-play · Bots         │     │
└──────────────────────────────────────┘     │
        │ chosen action                      │
        ▼                                    │
┌──────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────┐
│ Content modules  │──▶│ Rules engine                 │──▶│ Persistence          │
│ Base game        │   │ State + action → next state  │   │ Action log           │
│ Invaders from    │   │ Legal moves · scoring        │   │ Autosave (IndexedDB) │
│ Afar             │   │ Seeded randomness            │   │ Save files           │
│ Campaign (later) │   └──────────────────────────────┘   └──────────────────────┘
└──────────────────┘
```

A seat (you or a bot) picks an action, the engine applies it, the new state redraws the screen, and the action is appended to the log that autosave writes. Content modules define the factions, mats and cards the engine runs.

## Rules engine and data model

The engine is a pure, deterministic function: given a game state and an action, it returns the next state. It has no graphics, no timers and no network, so it runs the same in the UI, in tests and inside an AI search.

**Core shape**

```
applyAction(state, action) -> newState
legalActions(state, seat) -> Action[]
isGameOver(state) -> boolean
score(state) -> FinalScores
```

**Game state** (plain data, serializable to JSON)

- Setup: player count, seat types, factions, player mats, enabled modules, RNG seed
- Board: hex territories, terrain, rivers, tunnels, lakes, the Factory, home bases, encounter tokens
- Per player: units (character, mechs, workers) and their hexes, resources on hexes, coins, power, popularity, combat cards, stars, upgrades, recruits, structures, mech abilities unlocked, objective cards, last section used
- Shared: decks (combat, encounter, factory, objective) in shuffled order, structure bonus tile, turn order, current player, phase within the turn
- Pending decisions: anything waiting on a choice (combat dial, encounter option, which resources to spend)

**Actions as small, explicit steps.** A turn is broken into choices: pick a player mat section, then each sub-step (move this unit, pay this cost, take this bottom-row action). Each choice is its own action. This makes undo, AI search and the UI all simpler.

**The action log is the source of truth.** A game is its setup plus an ordered list of actions. Replaying the log rebuilds any state, which gives us saves, undo, replays and bug reports for free.

**Determinism.** All randomness (shuffles, card draws) comes from a seeded random number generator stored in state, never from the system clock or `Math.random()`. Same seed plus same actions always produces the same game.

**Testing.** Rules are verified with automated tests: scripted scenarios ("a mech with Riverwalk can cross onto a farm") and fuzz tests where bots play thousands of random legal games and the engine checks invariants (no negative resources, unit counts match, the game always ends).

## Content modules

The core engine knows the turn structure; everything else is content that a module registers. Turning an expansion on or off is a setup choice, not a code change.

**What a module can register**

- Factions: home base, starting units, faction ability, four mech abilities
- Player mats: section layout, costs, upgrade slots, starting popularity and coins
- Cards: encounter, factory, objective, combat
- Board changes and structure bonus tiles
- Rule hooks: points where a module can add or change behavior ("before combat," "on game end," "when a star is placed")
- A bot personality for each of its factions (kept in `packages/bots/src/personalities.ts`, by faction ID; a faction without one, such as your own, plays balanced)

| Module | Contents | When |
| --- | --- | --- |
| Core | Board, turn structure, actions, combat, scoring | Phase 1 |
| Base game | 5 factions, 5 player mats, all base cards | Phases 1–2 |
| Invaders from Afar | 2 factions, 2 player mats, their bot personalities | Phase 5 |
| Campaign | Persistent progress across games, unlocks, modules turned on over time | Phase 5 |
| Later expansions | The Wind Gambit, other maps, modular board | Optional |

**Faction rules stay in data where possible.** Most mech abilities are variations on movement, combat or recruiting, so they're described as data ("may move across rivers onto forest and mountain"). Only truly unique abilities get custom code through a hook.

## Seats: humans and bots

Every player is a seat with one job: when it's their turn, look at the state and the legal actions, and choose one. The engine never knows or cares what kind of seat it is.

```
interface Seat {
  chooseAction(view, legalActions) -> Promise<Action>
}
```

| Seat type | How it chooses | Notes |
| --- | --- | --- |
| Human | Waits for taps in the UI | Gets a "view" that hides other players' hidden cards |
| Pass-and-play human | Same as human, with a handoff screen between turns | Hides your combat cards and objectives until the next player taps in |
| Bot | Tries out whole turns in the engine and picks the best by a position score, tilted by its faction's personality | Runs in a background thread (Web Worker) so the UI never freezes; thinks for at most 2–3 seconds a turn on the iPhone |

**Bots play the real game.** No Automa (dropped Nov 2, 2026: on a screen it's just a very simple computer). Bots use `legalActions` and the same rules as you, and see only what a player at the table could see (no peeking at your combat cards, objectives or the decks).

**How a bot thinks.** Built in layers, each reusing the one before:

1. **Turn planner:** the engine's small steps are grouped into whole turns (section, top row, bottom row, every choice in between), so a bot compares complete turns.
2. **Position score:** a formula for "how well am I doing": coins, stars, territories and resources at my popularity tier, plus progress (upgrades, mechs, structures, recruits, workers out, power, combat cards, closeness to the Factory and to stars). Its weights can be adjusted.
3. **Personality:** each faction's bot tilts the weights and adds a few priorities, so it plays like that faction would. It still plays to win; the personality is a bias, not a script.
4. **Difficulty = smarter, not a different personality:** Easy picks good-but-not-best turns more often and thinks one turn ahead; harder levels make fewer slips, look further ahead and judge fights better. Every level keeps its faction's personality.
5. **Later (Phase 5):** tree search on top of the same score for the strongest level, and self-play on the Linux machine to tune the weights.

**Faction personalities** (first sketch, to be tuned in play-testing):

| Faction | Leans toward |
| --- | --- |
| Nordic | Spreading out: workers across rivers early, lots of territory, fights only when it's clearly ahead |
| Rusviet | Tempo: repeating its strongest section, a fast economy, an early push to the Factory |
| Polonia | Encounters and popularity: hunting encounter tokens, avoiding fights, high popularity for a big payout |
| Crimea | Pressure: building up combat cards, using Coercion, picking fights and taking territory |
| Saxony | Stars by any route: objectives and combat stars, fights when a win is likely |

**Fights and bluffing.** A bot doesn't always dial its maximum power; it mixes its choices so you can't read it, and it weighs what you might have in hand from what it has seen.

**Bot pacing.** Bot turns are shown step by step with a short delay, plus a "skip to my turn" button, so you can follow what they did.

## Persistence: autosave and save files

The game saves itself after every action, and any game can be exported as a small file. Because a game is just setup plus an action log, a full save is a few kilobytes.

- **Autosave:** written to on-device storage (IndexedDB) after every action. Opening the app offers "Continue" on the most recent game.
- **Save slots:** a list of in-progress and finished games with date, factions and turn number. Multiple games can run at once.
- **Export and import:** a save downloads as a `.scythe.json` file you can keep in the Files app, AirDrop to the Mac, or reopen later. Import validates the file by replaying it.
- **Undo:** step back through your own actions on the current turn. Undo is off once a bot has acted or hidden information was revealed.
- **Versioning:** each save records the engine version. If rules change later, old saves still load, either replayed with the old rules or flagged clearly.
- **Campaign saves:** campaign progress is a separate record that points to the games played within it.

**Storage safety on iPhone:** installed home-screen apps keep their storage, but iOS can still clear it in rare cases (for example, deleting the app). Regularly exporting saves, or an optional "back up all saves" button, covers this.

## Your own maps, factions and mats

Found along the way: because every save carries the full map, factions and mats it was played with, players can bring their own into the game, not just the built-in ones.

- **Library:** the player's own maps, factions and mats are kept on the device (IndexedDB, next to the saves) and offered on the new game screen after the built-in ones, marked "yours". They can be removed there; games already saved keep their own copies.
- **Getting them in:** "Import…" on the new game screen takes a content file (`.scythe-content.json`) or any save file, whose map, factions and mats are added. Each editor (map, faction, mat) has "Add to game", which puts the item straight into the library, and "Save to a file", which makes a content file to share or keep.
- **Duplicates:** anything exactly like what's already there is skipped. Adding one with the same id as one of yours replaces it (a newer version). A changed built-in one is kept alongside the original as "<name> (custom)".
- **Checks:** imported items are checked before they're added (faction and mat rules, and that a map's rivers and home bases sit on real hexes), with a plain message naming what's wrong.

## Presentation

The first version is a clean, readable 2D board drawn in SVG, designed for an iPhone in **landscape** and scaled up for the Mac (the game stays sideways however the phone is held, and the menus also work upright; see "Menus upright" and "Game always sideways" below). Everything visual reads from game state and never changes rules.

**iPhone layout (landscape)**

- Board fills the screen with pinch-zoom and pan; tap a hex to see what's on it
- Your player mat lives in a bottom drawer: peek shows the four sections and costs, swipe up for the full mat
- Top bar: turn order, stars, popularity and power for every player at a glance
- Prompts appear as a bottom sheet ("Choose up to 2 units to move") with clear confirm and undo
- Legal moves are highlighted on the board, so you never have to guess what's allowed

**Mac layout (landscape)**

- Board in the center, your mat docked below, opponents' summaries in a side panel
- Mouse hover shows details; keyboard shortcuts for confirm and undo

**Path to polish.** The view is built as layers so each can be upgraded alone:

1. **Art pass:** original illustrated hexes, faction colors, unit icons (could be generated with ComfyUI on the Linux machine and refined)
2. **Animation:** units slide between hexes, resources pop, combat dials spin
3. **Sound:** ambient music, UI sounds, combat stingers
4. **3D board:** a Three.js view of the same state, with models built in Blender, selectable as an alternative to the 2D board

**Accessibility:** large tap targets, colors paired with shapes or icons for factions, and readable text sizes on a phone.

## Tech stack and project layout

Everything is TypeScript, kept in one Git repository, so the engine, bots and UI share the same types.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Catches rule bugs at compile time; one language everywhere |
| Build tool | Vite | Fast, simple, first-class PWA plugin |
| UI | Svelte 5 | Small and fast on the phone, built-in animation, short readable components |
| Board | SVG | Sharp at any size; easy hit-testing on hexes |
| 3D (later) | Three.js | Runs in the same app |
| Offline | Service worker via vite-plugin-pwa | Caches the app for full offline play |
| Storage | IndexedDB | Reliable on-device saves |
| Bots | Web Workers | AI thinking off the main thread |
| Tests | Vitest | Unit, scenario and fuzz tests for the engine |
| Hosting | GitHub Pages | Static files over HTTPS, required for install |

**Repository layout**

```
scythe/
  docs/
    DESIGN.md    this document
  packages/
    engine/      rules, state, actions, RNG (no UI imports)
    content/     modules: base, invaders-from-afar, campaign
    bots/        turn planner, position score, faction personalities
    app/         PWA: board, mats, menus, saves
  tools/         simulation runner, balance checks (runs on the Linux machine)
```

**Rule for the codebase:** `engine` imports nothing from `app`. If the engine ever needs to know about the screen, the design has gone wrong.

## Phase plan

Each phase ends in something playable on the phone. A phase is done when its checklist is ticked. Tick boxes in this file as items are completed.

**Phase 0: Setup**

- [x] Monorepo, Vite, PWA plugin, Vitest
- [x] CLAUDE.md
- [x] GitHub repo and Pages deploy
- [x] Installs on iPhone and opens in airplane mode

**Phase 1: Engine core and hot-seat board**

- [x] Board data: all hexes, terrain, rivers, lakes, tunnels, home bases
- [x] Turn structure: choose a section, top-row action, bottom-row action, can't repeat the last section
- [x] Player mats as data, with a mat editor so new mats can be designed (like the map editor)
- [x] Factions as data, with a faction editor (home base, power, combat cards, stars, abilities, recruit bonuses)
- [x] 2 factions and 2 player mats (Nordic + Rusviet; Industrial + Engineering), entered from the physical game
- [x] All four top-row and four bottom-row actions, with costs and rewards
- [x] Movement, production, workers and resources on hexes (crossing rivers and lakes, Speed and combat on moving come with mech and faction abilities in Phase 2)
- [x] 2D board, player mat drawer, legal-move highlighting, zoom and a camera that follows the turn (the board keeps evolving with play-testing)
- [x] Installs on iPhone and runs offline
- [x] Done when: two humans can play a full turn cycle pass-and-play on the phone

**Phase 2: Full rules and all content**

- [x] Combat (power dial, combat cards), retreats, popularity loss
- [x] Mechs and all mech abilities; faction abilities
  - Base game done (Nov 1, 2026): every faction and mech ability of the five base factions works, including Polonia's Meander (since encounters). Abilities are rules on the faction data; Invaders from Afar's factions get theirs with that expansion, in Phase 5.
  - Done from play-testing: a Speed unit can drop off and pick up workers and resources at each hex along the way, using the side panel's pick-up slots, with the map updating live.
- [x] Stars, triumph track, game end and final scoring
  - Stars are placed on the triumph track as they're earned (shown in the top bar). The sixth ends the game at once; a final scores screen shows each player's coins, stars, territories and resources at their popularity tier, and the winner (with tie-breakers). Objective stars and structure bonus tiles join when those are entered.
- [x] Encounters, the Factory, objectives, structure bonus tiles
  - Encounters (Nov 1, 2026): tokens on the map, a shuffled deck, the card in a pop-up with its three options (greyed out when you can't pay), rewards of every kind (coins, power, popularity, combat cards, workers and resources on the hex, resources of your choice, free Upgrade/Deploy/Build/Enlist), and Meander. New games use a made-up sample deck of 6 cards for now.
  - Real structure bonus tiles built in (Nov 5, 2026): the owner's six (`baseStructureBonuses` in `packages/content/src/modules/base/structure-bonuses.ts`, replacing the made-up samples): tunnels next to, structures on tunnels (a Mine isn't a tunnel), lakes next to, encounters next to, the longest straight row (rivers don't break it), structures on farms and tundras. Farms and tundras count together, mixed in any way. The tile editor starts from these when it has nothing saved; the codex no longer calls them made-up.
  - [x] Encounter card editor, to enter the real deck from the physical cards (with "Add to game" / "Save to a file")
    - Done (Nov 2, 2026): encounters.html, linked from the main menu. Once your cards are added, new games draw from them in place of the sample deck; the new game screen shows your deck as one line (✕ goes back to the sample). Still to do: enter the real deck.
  - [x] The Factory
    - Done (Nov 2, 2026): ending the character's move on the Factory (after winning any fight) offers players + 1 cards; keep one (one a game, the rest go under the deck). It becomes a fifth section after the mat: its top part (pay → gain, resources paid from hexes you control, Coercion allowed, free bottom-row actions) then its move (so many units, so many hexes), and no bottom row. New games use a made-up sample deck of 8 cards for now.
  - [x] Factory card editor, to enter the real deck (like the encounter card editor)
    - Done (Nov 2, 2026): `factory.html`, linked from the home screen. Each card's top part (cost, resources, rewards, free actions) and move; "Add deck to game" makes new games use it in place of the sample deck (shown as "Factory deck" on the new game screen, removable there); save to a file or Export to paste into chat.
  - [x] Objectives
    - Done (Nov 2, 2026): each player is dealt objective cards at setup (as many as their mat says), shown only on their own mat drawer with a ✓ when ready. At any point of your own turn, a gold "★ Complete objective" button places a star; then the other card stays in hand but can't be completed (Saxony's Dominate lifts that). A card can be marked "end of your turn only" (completing it before the bottom row ends the turn). Each card is a list of conditions as data: power/popularity/coins/combat cards, resources you control (in all, or of each kind), units on a terrain, territories (of a terrain), upgrades/mechs/structures/recruits/workers, each "at least" and/or "at most". New games use a made-up sample deck of 10 for now.
  - [x] Objective card editor, to enter the real deck (like the encounter and Factory card editors; may need new kinds of condition for some cards)
    - Done (Nov 2, 2026): `objectives.html`, linked from the home screen. Each card's name, story, "only at the end of your turn", and its conditions (add, remove, change the kind; at least / at most), with the game's wording shown below. "Add deck to game" makes new games deal from it (shown as "Objective deck" on the new game screen, removable there); save to a file or Export to paste into chat.
  - [x] Structure bonus tiles
    - Done (Nov 2, 2026): one tile drawn at random for each game, shown under the round card (tap it for its payouts). At the end, each player's structures are counted as the tile says (tunnels, lakes or encounter spots next to them; on tunnels or certain terrains; the longest straight row) and pay coins by step, whatever their popularity; a Structures column on the final scores. New games use 6 made-up sample tiles for now.
  - [x] Structure bonus tile editor, to enter the real tiles (like the card editors)
    - Done (Nov 2, 2026): `structure-bonuses.html`, linked from the home screen. Each tile's name, what it counts (spots next to your structures; your structures on tunnels or terrains; your longest straight row) and its payout steps, with the game's wording shown below. "Add tiles to game" makes new games draw from them (shown as "Structure bonus tiles" on the new game screen, removable there); save to a file or Export to paste into chat. Still to do across this item: enter the real encounter, Factory and objective cards and the real tiles.
- [x] All 5 base factions and 5 mats
  - Done (Nov 1, 2026): Nordic, Rusviet, Polonia, Crimea, Saxony; Industrial, Engineering, Patriotic, Mechanical, Agricultural. Up to 5 players. Invaders from Afar's factions and mats moved to Phase 5 (Nov 2, 2026).
- [x] Autosave, save slots, export and import
  - Done (Nov 1, 2026): every game is saved on the device after each move and undo; Saved games lists them (play, save to a file, delete) and opens `.scythe.json` files, checking each by replaying its moves. A file of a game already on the device opens as a copy, never overwriting. On iPhone, saving to a file uses the share sheet (Save to Files, AirDrop). Undo picks up where it was after reopening a game.
- [x] Your own maps, factions and mats: a library on the device, imported from content or save files, or added from the editors (not in the original plan; added Nov 1, 2026)
- [x] Done when: a complete 5-faction game can be played to final scoring and reloaded from a file
  - Checked (Nov 2, 2026): a test plays three complete 5-faction games (every deck in: encounters, a Factory card, objectives, a structure bonus tile; about 1,000-1,400 moves each) to final scoring, saves each to a file and reads it back to the same game and scores (`packages/app/src/saves/full-game.test.ts`). In the app, such a file opens straight on its final scores (fixed: it used to ask to pass to the next player first). Random play favours Crimea (19 of 40 games): one free resource a turn from Coercion matters a lot to players who rarely have resources; with Coercion off the wins even out, so it's not a rules bug.

**Phase 3: Bots with faction personalities** (replaces the Automa plan, Nov 2, 2026)

- [x] Turn planner: list a bot's complete turns from the engine's small steps
  - Done (Nov 2, 2026): `packages/bots/src/planner.ts`. A plan runs to the end of the turn, or stops where something new comes into view (a fight, an encounter card, Factory cards) or the game ends; the bot plans again from there. Simplifications: a unit takes all the resources on its hex or none, and mechs and workers are interchangeable, so the same position reached two ways counts once. Early turns have about 50–200 distinct plans; late turns with 4 mechs and 7 workers, tens of thousands (up to 15 seconds to list), so bots will use a beam: keep the best few unfinished turns of each section at every step, by the position score (item 2). With 10 per section, the slowest late turn plans in about 0.35 s on the Mac (roughly 1 s on the phone). Combat cards drawn during a plan are visible in it: the score must count them, not read them. The engine gained `applyLegal` (applyAction without re-checking legality, for search).
- [x] Position score with adjustable weights
  - Done (Nov 2, 2026): `packages/bots/src/score.ts`. A seat's value in roughly coins: what final scoring would give now, plus what pays off before the end (upgrades, mechs, structures, recruits, workers, power, combat cards, closeness to each star, a ready objective, a Factory card, resources as fuel up to what the remaining bottom-row actions need, workers ready to produce a resource that's short, the character's distance to encounters and the Factory), worth less as the leader nears their last star. Popularity counts toward the next tier until the last third of the game. The score is your value minus half the best rival's (`rivalry`). It counts combat cards by number and reads only its own objectives, so it never peeks. All 16 weights are plain data in `DEFAULT_WEIGHTS`, for personalities and tuning. A quick trial: one bot picking each turn by this score (fights still random) beat four random players in 10 of 10 five-player games; about 60 ms a decision on the Mac, at most about 340 ms.
- [x] A bot that plays whole games by trying each turn and keeping the best (no personality yet), beating random play in simulations
  - Done (Nov 2, 2026): `planningBot` in `packages/bots/src/bot.ts` plans its turn (planner + position score, keeping 8 per section), plays it out, and plans again wherever the plan stops. Fights use a stand-in rule until item 5 (best card, then half its power). Every player is now a `Seat` (engine `view.ts`), shown `playerView`: the game with the others' combat cards, objectives and secret fight choices masked, the decks out of order and the random seed replaced, which a fuzz test shows never changes what the seat itself may do. `playMatch` plays whole games between seats; `npm run sim -- --games 10 --players 5 --bots 1 --width 8` runs them. Results: 1 bot against 4 random players won 10 of 10; 5 bots against each other finish in 23–48 turns each (34 on average; real games run 20–30); thinking at most about 280 ms a decision on the Mac. Score fixes found by playing: a finished game scores by its result (a bot was refusing to place its winning sixth star); closeness to stars no longer fades near the end; being able to pay for producing counts (bots at 0 power froze); time left is judged from the leader's pace, not their star count (bots stopped building up in a slow game). Seen in the bot-only games, for later steps: Rusviet won 4 of 6 and Nordic often came last; and a fight can place a bot's sixth star while it's behind, ending a game it loses (item 5).
- [x] Faction personalities for all 5 base factions
  - Done (Nov 2, 2026): `packages/bots/src/personalities.ts`. Each is a line describing it, tilts to the score's weights, and a boldness in fights (0–1, used by the stand-in fight rule now and by item 5). A bot plays its faction's personality unless told otherwise; a faction without one (your own) plays balanced. The score gained an extra-per-territory weight and separate pulls toward encounters and the Factory. Checked in 8 five-bot games against the same games played balanced: Polonia takes about 6 times as many encounters and keeps popularity higher (8.6 against 5.0); Nordic starts far fewer fights (1.3 a game against 8.0); Crimea holds more combat cards (2.1 against 0.6) and won 4 of 8; Rusviet builds more mechs and upgrades. Still mild: territory (limited by units more than by weights) and Saxony, whose route to stars is fights, which item 5 brings. Wins stay about the same as balanced, so the leanings don't cost strength.
- [x] Fights: choosing power and combat cards, with some bluffing, from only what the bot can see
  - Done (Nov 2, 2026): `packages/bots/src/fight.ts`. For each way to fight (its best 0, 1, ... cards, each dial), the bot imagines the other side's hand (dealt from the cards it hasn't seen: the deck less its own hand and the face-up discards) and their dial, plays the fight out in the engine, and averages the position score after it, 12 imagined fights each. So a costly win, or a win that places its sixth star while behind, scores badly by itself. It then picks among the near-best choices at random (bluffing). A plan whose move starts a fight is judged by the fight's likely outcome (each distinct fight worked out once per decision). Boldness (from the personality) sets how high it expects the other side to dial; lowered for every personality (the boldest is now Crimea, 0.55), since Scythe rewards building up far more than fighting (owner's note). Against otherwise identical bots using the old stand-in rule, in 16 two-player games with seats swapped: attacks lost 9 of 70 (stand-in 22 of 68), power spent in lost fights 11 (stand-in 46), winning margin 1.3 (stand-in 2.2, overspending), fights won against each other 83 to 55, games 10 to 6. Fights rarely decide games (whole games came out identical with the seats swapped). Slowest decision about 220 ms on the Mac, except in one setup whose games stall for 750 turns either way round, with every unit out (to look into next).
  - Stall fixed (Nov 2, 2026): in that setup (Saxony against Nordic, seed 704) Saxony sat still from turn 1, because the bonus for being able to pay for producing outweighed what producing would bring once it used up the last power; and Nordic stopped one star short of winning, the steps toward its last star each looking no better than doing nothing. The bonus is now 2 (still enough to bolster at 0 power), and a bot one star from the end and ahead on coins counts progress toward its closest star 4 times over (`finishing`). That game now ends in under 60 turns each (a test guards it). Afterwards: 10 two-player bot games average 41 turns each (all finished), 6 five-bot games 34; slowest decision 289 ms on the Mac. Still to watch: Nordic hasn't won a five-bot game.
- [x] Difficulty levels (Easy, Medium, Hard): smarter at each level, same personality
  - Done (Nov 2, 2026): `LEVELS` in `packages/bots/src/bot.ts`; `planningBot({ level })`, Medium by default. Easy keeps 3 turns per section while planning, picks at random among turns within 6 coins of its best, and tries 4 imagined hands per fight choice; Medium keeps 6, within 1.5, 8 hands; Hard keeps 10, always takes its best, 16 hands, and looks ahead: for its 4 best turns it also plans its next turn (as if the others changed nothing) and counts 60% of what that adds. In 18 three-player games, one bot of each level, seats and factions rotating: Hard placed above Medium in 12, Medium above Easy in 13, Hard above Easy in 17; wins Hard 12, Medium 6, Easy 0. Slowest decision on the Mac: Easy 156 ms, Medium 264 ms, Hard 964 ms (perhaps 3 s on the phone: item 7's time limit caps it).
- [x] Bots think in a Web Worker, at most 2–3 seconds a turn on the iPhone
  - Note (Nov 2, 2026): Hard's slowest decision is about 1 s on the Mac, maybe 3 s on the phone; measure on the phone and add a time limit (stop searching and take the best so far).
  - Done (Nov 2, 2026): bots run in a background thread (`packages/app/src/bots/bot.worker.ts`, talking through `botHost`/`BotClient` in `packages/bots/src/remote.ts`; a test shows a game played through it comes out identical to one played directly). Each decision has a time limit (2 s by default): past 60% of it the planner keeps only its single best turn per section, and past 85% Hard stops looking ahead and new fights aren't worked out, so it always answers with the best found so far (tests with a fake clock). A speed check page (Home → Workshop → Bot speed check, `bot-check.html`) plays a 4-bot game (two Hard, two Medium) through the worker and times every decision on the device. On the Mac (6 rounds): Hard typically 0.06 s, slowest 0.07 s, slowest wait including messaging 0.15 s; none near the limit. Still to do by the owner: run it on the iPhone once deployed.
- [x] Solo and mixed games on the new game screen (any seat can be a bot, with its level)
  - Done (Nov 2, 2026): each seat on the new game screen has "Played by": You (or A person, when more than one person plays), Easy bot, Medium bot or Hard bot. A new game starts as you against a Medium bot; every seat a bot makes a game to watch. The save remembers which seats are bots (`bots` in the save; older saves are all people). In the game (`Game.svelte`, rules in `play/seats.ts`), bots think in the background thread and play one move at a time (at least about half a second each until item 9's playback); meanwhile the side panel says who is playing, the controls are off, and their combat cards, objectives and choices (encounters, the Factory, fights: "is choosing…") stay hidden. Their moves can't be undone. The pass screen only shows between different people: never to a bot, and never in a solo game. Checked in the browser: 3 bots played 8 rounds in a minute; you (a simple scripted player) against a Medium bot, 15 rounds; a game reopened after closing carries on; no errors.
- [x] Bot turn playback with skip
  - Done (Nov 2, 2026): a bot plays its moves one at a time: about 0.9 s on the ones worth watching (its section, each unit's move, producing, bolstering, upgrading, deploying, building, enlisting, encounters, the Factory, fights) and 0.2 s on the small steps between (paying, ending a move). The side panel tells its turn as it goes, in plain lines (`play/narrate.ts`): "Chose Produce / Upgrade", "Moved the character to D7, a worker to D6", "Produced on A4, B5", "⚔ Rusviet wins on C2 (7 to 5)", "★ Star for winning a fight", "Now: +2 metal, −1 coin". "Skip to your turn" plays the bots on at once, without their animations, until a person must act (in a game with no people: to the end of that turn). On your turn, "📜 Bots' turns" lists what each bot did since your last turn. Checked in the browser: a bot's turn watched in about 3 s, skipped in about 0.6 s; the bot's side of a fight shows "is choosing…" and none of its cards. The test browser can't play the fight animation (it closes there in pass-and-play games too), so fights against a bot are for the owner to check on the Mac or phone.
  - Recruit bonuses shown (Nov 3, 2026, owner's request): checked that ongoing recruit bonuses pay out to the player and both neighbours (tested in the engine, which now says who gets paid: `recruitPayouts`). When a bottom-row action pays any, a recruit appears over the map with a "+1" chip for each player paid, in their colour, and each chip flies to that player in the top bar.
- [x] Done when: a full solo game against 1–4 bots plays without errors on the phone, and in simulations Hard beats Medium and Medium beats Easy most of the time
  - Done (Nov 4, 2026): the owner played a whole game on the iPhone against 3 bots at different levels, without errors, and won; Hard over Medium over Easy shown in simulations (item 6).

**Phase 4: Polish**

- [ ] Art pass, animation, sound
- [x] Theme editor for the whole game, for the owner's own pictures (e.g. made in ComfyUI), in the app (owner's request, Nov 2, 2026)
  - [x] The board
    - Done (Nov 2, 2026): Workshop → Theme editor (`themes.html`, `src/theme-editor/`, model in `src/theme/theme.ts`). Slots: the map background; art for each of the 7 terrains, filling its hexes (cropped to the hex); each terrain's symbol (hidden over hex art unless asked for); the tunnel and encounter markers; the 4 resource tokens; and each terrain's colour. Each slot shows its best picture size in pixels, in multiples of 16 (hex art 448 × 512, matching the hex; background 1600 × 896; symbols, markers and tokens 256 × 256); bigger pictures are shrunk to that as they come in and kept as data on the device (IndexedDB, beside the library), used by the game from the next time it opens. A theme saves to and opens from a `.scythe-theme.json` file (Mac ↔ phone); opening one keeps only known slots, inline pictures and plain colours. Pictures must be the owner's own, never scans of the published game.
    - Map picture (Nov 2, 2026): the background is now one painting of the whole map, drawn inside the board in the map guide's frame (`play/map-picture.ts`: the hexes centred in 1600 × 896 with a 40-pixel margin on the tighter side), so it lines up with the hexes and zooms and pans with them; its edges fade into the board's background. By default it is the hexes' art: hexes are see-through over it (with faint edges, or none) and hex art is set aside. The editor saves the map guide (the default map in flat terrain colours, black around it, optionally with rivers) to paint it from, e.g. through ControlNet in ComfyUI.
    - Hex art kept as PNG (Nov 3, 2026), so it can have see-through parts: they show the map picture behind, or else the terrain's colour. Only the map picture is kept as JPEG.
    - Hex art is only cropped, never stretched (Nov 5, 2026, owner's choice; it used to be cropped to a square and then pulled about 14.5% taller): each picture is fitted in a box the hex's own shape (`HEX_VIEWBOX` in `play/geometry.ts`). A 448 × 512 picture fills the hex, losing about 1% of its width, 2 pixels off each side.
    - Several pictures for a terrain (Nov 5, 2026, owner's request): each hex art row takes any number (Add…, several files at once; × removes one; Clear all). Each hex shows one at random, worked out from the game's seed and the hex (`hexArtIndex` in `theme/theme.ts`), so the mix changes from game to game while a hex keeps its picture through undo and reloading a save. Only the look: the engine never sees it. The first picture stays in the usual `hex.<terrain>` slot and the rest are in `moreHexArt`, kept in theme and skin files, so older themes open as they were. The editor's small preview shows each terrain's first picture; the Codex's Maps tab shows the mix.
  - [x] Units and crests (characters, mechs, workers, structures, faction crests)
    - Done (Nov 3, 2026, in the faction editor, owner's choice: they belong to each faction): Workshop → Faction editor → Pictures. Each faction can have a crest, its character, a mech, a worker and each of its four structures (best sizes: figures 384 × 512, the rest 256 × 256, see-through backgrounds). They're kept in the theme under the faction's ID (`faction.<id>.<part>` in `src/theme/theme.ts`), so they go to the phone in the theme file; they follow the faction if its ID is changed, and a duplicate gets copies. In the game: the crest on the side panel, the new game screen, the faction's screen and the final scores; the character and mechs on the map (standing on a small base in the faction's colour, so ownership stays clear), at home, walking, in fights and on the faction's screen; workers (with a count when several stand together) and structures on the map. Anything left empty keeps the usual piece in the faction's colour. Not yet: a newly deployed mech still flies in as the usual shape before landing as the picture.
    - Map pieces (Nov 5, 2026, owner's request): the character and mech can each have their own picture for the map (faction editor → Pictures → Character on the map, Mech on the map; best 384 × 512), apart from the full figures used in fights and on the faction's screen: e.g. a token, or a bolder drawing that reads when small. Without one the map shows the figure, as before (`boardLook().piece` in `src/theme/theme.ts`).
    - Codex background (Nov 5, 2026, owner's request): a faction's own picture behind its character and mech on its Codex page (faction editor → Pictures → Codex background; best 768 × 1024, JPEG, cropped to fit). Without one, one of the skin's fight backdrops at random (picked again each time the page shows), else the drawn land by its home base (`codexScene` in `menu/codex.ts`).
    - Codex faction page (Nov 5, 2026, owner's request): the figures cast a soft dark shadow there instead of a glow in the faction's colour (`FighterArt` `shadow="soft"`; fights keep the glow), and the portrait is large (up to 170 px, in a ring of the faction's colour) beside the name, start and faction ability. Later the same day: the crest stands large (56–96 px) beside the faction's name rather than as a badge on the portrait, and the figures' shadow is bigger (a dark outline plus a wide offset shadow) to lift them off the backdrop.
    - Faction story (Nov 6, 2026, owner's request): each faction's Codex page can tell its character's name and bio and the faction's capital city, history and goals, written in the faction editor (Story) or on the Names and wording page. Kept in the skin's words under the faction's ID (`lore`, `setLoreWord` in `skins/words.ts`), so each skin tells its own and it travels in the skin file; it never reaches the engine, saves or bots. Line breaks stay as typed; names up to 60 characters, longer parts up to 3000. Only what's written shows; a faction with no story has a short pointer to the editor. With a faction's ID changed its story follows, and Duplicate copies it. No story text is built in, since a skin's renamed factions wouldn't match it.
    - Crests on home bases (Nov 6, 2026, owner's request): on the map, in games and the Codex, a faction's home base shows its crest (its picture, else the drawn shield) instead of a circle in its colour; an unused base stays a dark circle. A see-through circle stays over the crest for tapping and highlights, and a character at home stands at the crest's lower right so the crest still shows.
    - Portrait (Nov 4, 2026, owner's request): a picture of the character's face, apart from the full-body figure (faction editor → Pictures → Portrait, best at 512 × 512). Shown round, in a ring of the faction's colour (`play/FactionPortrait.svelte`), beside the crest on the new game screen and the faction's own screen, beside the name on the fight screen and the battle's tallies, and on the final scores. Where a faction has none, those places look as before.
  - [x] Fight scene (fighters, backdrops)
    - Fighters: each faction's character and mech pictures (faction editor, see above).
    - Numbers last (Nov 5, 2026, owner's request): what each side played (power, cards, total) shows only once the dust clears, with the winner's banner; before that, only their names. The fight is also quicker to start (the charge comes after 0.9 s, not 1.5 s).
    - Backdrops done (Nov 3, 2026): Theme editor → Fight backdrops, one per terrain (best at 1600 × 896, kept as JPEG). A fight on that terrain shows the picture behind the fighters, and so does a faction's own screen when its character stands there; a village without one borrows the farm's (as the drawn scenery does). The picture keeps its point 70% down on the screen's ground line, where the fighters stand, and is cropped at the top and bottom on wide screens. Terrains without one keep the drawn scenery.
  - [x] Look and feel (colours, fonts, panels, menus)
    - Done (Nov 4, 2026; owner chose colours, fonts from a built-in list, and pictures): Theme editor → Menus and panels. Seven colours (background, panels, buttons and cards, borders, text, accent, highlight), each with "Usual" to go back; the text on the accent and highlight turns dark or light by itself to stay readable. Two fonts, for titles and for words, from 12 already on the iPhone and Mac (nothing downloaded). A menu picture (1600 × 896: in full behind the opening menu, dimmed behind the others) and a side panel picture (512 × 1024, dimmed under the panel's words). A small preview shows a menu and a panel as they'll look. The colours and fonts are CSS variables (`uiStyle` in `src/theme/theme.ts`) the app's screens read, so new screens should use `var(--panel)`, `var(--accent)` and so on, never fixed colours. The board's highlight glows follow the highlight colour. Kept as they are: the drawn art (piece outlines, the paper round card, fighters) and the Workshop's editors. The usual titles font is now Georgia (as on the round card), so the menus' titles changed from the plain system font.
- [x] A dossier for each faction (owner's request, Nov 3, 2026)
  - Top bar (Nov 5, 2026, owner's request): factions listed in turn order (whoever went first leading, `inTurnOrder` in `play/seats.ts`); each button at least 44 × 34 points to be easy to tap on the iPhone; on a phone the resource line is left out so 5 players fit without scrolling (it's on the faction's screen).
  - Done: tapping a faction in the top bar opens its own screen (`play/FactionDossier.svelte`, facts gathered in `play/dossier.ts`): its character and a mech standing in the scenery of the character's hex, its crest, mat and who plays it (a bot's leaning too); its stars and what it would score if the game ended now (and its place); coins, combat cards, power and popularity (with the tier and its rates); progress toward every star; what it has on the map; its faction and mech abilities (locked until that mech is out); recruits (ongoing and one-time bonuses); structures and upgrades; its Factory card and objectives. Tabs switch factions. Combat card values and objectives in hand show only to their owner (never a bot's, and in pass-and-play only the person holding the device); completed objectives show to all. The pass screen closes it.
- [x] Pictures on encounter cards (a picture, a story line, both or neither), chosen in the encounter card editor (owner's request, Nov 2, 2026)
  - Plan: pictures are shrunk to about 100 KB and stored once on the device; cards hold a short reference, so saves stay small. Deck files carry the pictures; a game opened without them shows the story instead. A built-in deck's pictures ship with the app. Pictures must be original (drawn, photographed or generated), never scans of the printed cards.
  - Done (Nov 4, 2026): the encounter card editor has a picture for each card (Choose/Change/Clear, best at 768 × 512, 3:2 (owner's choice, Nov 4, 2026; was 800 × 448), shrunk to a JPEG of about 20–100 KB) and "Shows": the story, the picture, both or neither (by default the story, and the picture too once there is one). In the game and the codex the picture shows whole at 3:2 at the top of the card, as tall as the screen allows, with the story over its bottom when it shows both (a picture of another shape is cropped to 3:2). Cards hold only a reference (`picture: "pic-…"`, made from the picture itself, so a picture is kept once; `show`); pictures are kept on the device apart from the library and theme (`SaveStore.cardPictures`), go in the deck's file from "Save deck to a file" (and are kept when such a file is opened on the new game screen), and never go in saves. Where a picture isn't on the device, the card shows its story instead. Not yet: shipping a built-in deck's pictures with the app (there is no built-in real deck yet), and clearing pictures no card uses any more.

- [x] Top buttons on the iPhone (Nov 7, 2026, owner's report: Start, the faction screen's tabs and its exit were hard to hit, even after the top bar's buttons were made bigger). In landscape iOS reports no safe area at the top but keeps that edge for its own gestures, and these buttons started 0 to 6 px from it. Every screen's top now uses `--safe-top` (`style.css`, and `shared/forms.css` for the editors): 18 px below the edge on a phone held sideways, nothing extra elsewhere. There, top-bar buttons are also at least 38 px tall and 44 px wide. Buttons, links and lists act at once rather than waiting for a possible double tap. Owner on a real iPhone: "much better". To tune it, change the 18 px.
- [x] Menus upright (Nov 7, 2026, owner's request): the "rotate your device" message is gone and the manifest no longer asks for landscape. Home, Saved games, New game, Codex, Skins and Workshop all work on a phone held upright, by `@media (max-width: 600px)` rules at the end of each screen's styles: New game and the Codex pages stack into one scrolling column (New game's seats come straight after the map and player count), Saved games' buttons drop under the game's name, Skins goes one card wide. A width rule, so a phone held sideways and the Mac are unchanged. Top-bar buttons stay thumb-sized upright too; the extra top margin stays sideways only, as iOS reports the notch's safe area upright. The editors never had the message and have no upright layout.
- [x] Game always sideways (Nov 7, 2026, owner's request): the game stays landscape however the phone is held, with no message. iPhones ignore the manifest's orientation and have no lock a web app can call, so on a phone held upright `.game-frame` (`App.svelte`) is drawn turned a quarter turn, at the size it would have sideways. Only phone-width screens turn it, so not iPads or the Mac. Everything in the game therefore measures the frame, not the physical screen: sizes use container units (`cqh`, `cqw`), phone rules use `@container screen` (the Codex is a `screen` container too, as it shows the Board), safe margins use `--safe-right`, `--safe-bottom`, `--safe-left` and `--safe-top`, which go round with the frame, and screen positions go through `play/frame.ts` (map drags and pinches, panel scrolling, flying pieces, which now fly inside the frame). New game screens: use these too, not `vh`, `env()` or `getBoundingClientRect`. The turn is always the same way round, so going from sideways to upright can flip the game 180 degrees relative to the hand, depending on which way it was held.
- [x] Filling the iPhone's screen (Nov 7, 2026, owner's report, with a screenshot: an empty strip at the bottom when upright and at the right when sideways). In the screenshot the game stopped at 763 of the phone's 844 points, which is the screen less its top and bottom safe areas, and the strip was the page's own background, so the phone was painting there. CSS can't ask for the real size, so in the installed iPhone app only (`navigator.standalone`, phone-sized screens) `shared/screen-fill.ts` sizes the page from `screen`, and `.game-frame` reads `--screen-width` and `--screen-height`. Every `position: fixed; inset: 0` screen fills the page, as it measures the body (`contain: layout`). The page is held at its origin, as it's now larger than iOS thinks, except while a text field is in use. Tried in a browser made to report the same short page (upright and sideways); Safari and other devices are unchanged. New pages: import `shared/fill-screen` first in their `main.ts`. On a real iPhone the first version left 34 points at the game's far end (owner's second screenshot, the same day): the home bar's safe margin, which on the turned game was only empty space, so there `--safe-right` is now 8 px, enough to clear the rounded corners; to tune it, change the 8 px in `App.svelte`. The notch's margin at the other end stays. A phone that iOS itself treats as sideways (rotation lock off) still keeps iOS's margins on both sides.
- [x] Smooth map with picture skins (Nov 7, 2026, owner's report: the map dragged slowly on the phone with the Reap skin, while emoji and drawn looks were fine). Each hex's art was an SVG pattern, and moving the map redraws the whole SVG. Timed in WebKit on the Mac, dragging with Reap's 36 patterns ran at about 40 frames a second against 60 without them; turning off the shadows on piece pictures made no real difference. The board now paints all the hex art once into one picture when it opens (`play/baked-map.ts`, used by `Board.svelte`, so the Codex's maps too) and moves that: 60 frames a second in the same test. The hexes stay on the board, see-through, to be tapped, and keep their edges. Until the picture is ready, or if it can't be made, the patterns draw as before. It's repainted only when the art or the map changes, not after each action. The same game drawn both ways shows the same picture, crop and scale in each hex. For Reap it's 3390 × 3263 pixels (a 17 MB PNG), a hex keeping its art's pixels, capped at 4096 on the longest side (`BAKE_MAX_SIDE`). Not yet confirmed on a real iPhone. The theme editor's small preview still uses patterns.
- [x] A codex on the main menu: everything for the game, one at a time and large (owner's request, Nov 4, 2026)
  - Done: Home → 📖 Codex (`menu/Codex.svelte`, what each shows in `menu/codex.ts`). Tabs for factions, mats, encounter cards, Factory cards, objectives and structure bonus tiles; ‹ › arrows, swiping, the arrow keys, or a list to jump to one ("3 of 8"). Factions: their character and mech in the land by their home base, crest and portrait, starting power, combat cards and stars, faction and mech abilities, recruit bonuses. Mats: turn order, starting popularity, coins and objectives, and each section's two actions with what upgrades improve, its structure and its recruit's bonus. Cards and tiles as the game shows them (encounter pictures included). It shows what new games use: your own decks once added, else the samples, marked as made-up.
  - Maps (Nov 4, 2026, owner's request): the first tab. Each map is drawn as the game board (with the theme's art), set up as a game starts on it: every faction with a home base there, its character at home and workers beside it, and the encounter tokens (`mapStart` in `menu/codex.ts`). Beside it: land hexes, rivers, tunnels and encounter spots, how many of each terrain, and who starts at each home base. Zoom and drag as in a game (swiping doesn't turn the page on a map; the arrows and keys do).
    - Mechs and structures on the map (Nov 5, 2026, owner's request): so the map shows every kind of piece, each faction there also has a mech beside its workers and its four structures close to home (`withSamplePieces` in `menu/codex.ts`), with any pictures from the faction editor. Only for looking at: no game starts this way. One structure to a hex, never on a lake or the Factory or with the workers; it can share a hex with an encounter token, as in a game.
- [x] Skins: a whole version of the game's look and names, kept and switched as one (owner's request, Nov 5, 2026: an alternate version with different faction names and pictures, the same mechanics)
  - Done: a skin is a theme (pictures, colours, fonts) plus its own words: each faction's name and colour, its faction and mech abilities' names and wording, and each mat's and map's name (`src/skins/skin.ts`). Words are keyed by the neutral IDs, so a skin never changes a rule or number, and bots keep each faction's personality (they go by ID). "Original" is the built-in look (drawn pieces, emoji, the usual names) and never changes; the device keeps any number of skins beside it (`SaveStore`: `skinIndex`, `skin`, `putSkin`, `useSkin`, `deleteSkin`; the theme from before skins became the first skin). Home → 🎨 Skins: each skin with its crests and names; Use, New skin from this, Rename, Save to a file (`.scythe-skin.json`, the whole theme and words), Delete, and Open a skin file. The editors change the skin in use: theme editor (look and pictures), faction editor (faction pictures) and the new Names and wording page (`skin-words.html`, with what each ability does in the game beside it; a blank keeps the original). A change made while Original is in use starts "My skin". The new game screen can switch skin; new games, the codex and the menus use the skin in use, and each game remembers the skin it was started in and shows in it.
  - Built-in factions in the faction editor (Nov 5, 2026, owner's request, after a rename there didn't reach the Codex): with one of the five built-in factions open, its name, colour and ability names and wording are the skin in use's words (saved there as each box is left; empty: the original), and its rules (ID, home base, power, cards, stars, recruit bonuses) are shown as they are, greyed out; Add to game and Save to a file are off (it's always in the game), and Duplicate makes a faction of one's own from it as the skin tells it. Names and wording changed earlier in the editor's copies move into the skin once (`wordsFromCopy` in `faction-editor/model.ts`); the copies then go back to the built-in ones.
  - The editor's saved list and the built-in factions (Nov 6, 2026, a bug the owner found with Saxony): the list is kept on the device and can be older than the built-in factions, so it could lack one or hold an old copy under another ID. That copy then showed its old name, wasn't marked built in, and kept new pictures under an ID the game doesn't use. Now the list is repaired on opening (`withBuiltIns` in `faction-editor/model.ts`): all five are always there, first; a copy with the same name and start takes the built-in ID and its pictures follow (pictures the built-in already has stay). Anything else stays as the player's own faction. Built-in factions can't be deleted from the list any more.
  - Cards in the skin file (Nov 5, 2026, owner's request): "Save to a file" asks whether to include the player's own encounter, Factory and objective decks (with the encounter cards' pictures; the made-up samples never go). Opening a skin file that carries cards asks whether new games should use them; if so they take the place of those decks (games already started keep theirs). The cards are checked like a content file's (`cardsToShare`, `parseSkinCards`, `useSkinCards` in `src/skins/skin.ts`). Decks stay the device's, not each skin's: switching skins doesn't switch decks.
- [ ] Optional 3D board
- [ ] Done when: it feels like a game, not a prototype

**Phase 5: Stronger AI and campaign**

- [ ] Strongest bot level: tree search on top of the Phase 3 position score, within the 2–3 second turn limit
- [ ] Self-play simulations on the Linux machine to tune the position score and personality weights
- [ ] Campaign module with persistent progress
- [ ] Invaders from Afar: its 2 factions (with their faction and mech abilities) and 2 player mats, up to 7 players, and their bot personalities (moved from Phase 2 on Nov 2, 2026: no physical copy; the owner knows it from the digital edition)
- [ ] Done when: the tree-search level beats Hard bots consistently in simulations, and a campaign can be played start to finish

## Open questions and risks

**Open questions**

- [ ] Do we have the physical game or PDF rulebooks (base; Invaders from Afar: no physical copy, Nov 2, 2026)? Card-by-card data entry depends on having them on hand.
- [x] Svelte or React for the UI? Svelte (5), chosen Oct 29, 2026 for its small size on the phone, built-in animation and readable code. Switching to React later would only touch the app, never the engine.
- [x] Which two factions and mats for Phase 1? Nordic + Rusviet; Industrial + Engineering.
- [x] Original faction names and theme, or neutral placeholders until the art pass? Answered by skins (Nov 5, 2026): the built-in names stay as Original; the owner's own version is a skin.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Rules accuracy: Scythe has many edge cases and FAQ rulings | Bugs that feel unfair or wrong | Scenario tests per rule; a rules-check log of sources; fuzz testing |
| Data entry: hundreds of cards and abilities | Slow, error-prone | Content as structured data files; validation scripts |
| Strategic AI difficulty: hidden information and a huge branching factor | Weak or slow AI | Build in layers (turn planner, position score, personalities) before search; time-boxed thinking; tune offline on the Linux machine |
| Phone performance during AI search | Hot phone, slow turns | Web Worker, time-boxed thinking, difficulty settings |
| Scope creep from polish and expansions | Never finishing | Phase gates: each phase must be playable before the next starts |

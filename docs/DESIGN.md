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
- A bot personality for each of its factions

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

The first version is a clean, readable 2D board drawn in SVG, designed for an iPhone in **landscape only** and scaled up for the Mac. Everything visual reads from game state and never changes rules.

**iPhone layout (landscape only)**

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
- [ ] A bot that plays whole games by trying each turn and keeping the best (no personality yet), beating random play in simulations
- [ ] Faction personalities for all 5 base factions
- [ ] Fights: choosing power and combat cards, with some bluffing, from only what the bot can see
- [ ] Difficulty levels (Easy, Medium, Hard): smarter at each level, same personality
- [ ] Bots think in a Web Worker, at most 2–3 seconds a turn on the iPhone
- [ ] Solo and mixed games on the new game screen (any seat can be a bot, with its level)
- [ ] Bot turn playback with skip
- [ ] Done when: a full solo game against 1–4 bots plays without errors on the phone, and in simulations Hard beats Medium and Medium beats Easy most of the time

**Phase 4: Polish**

- [ ] Art pass, animation, sound
- [ ] Pictures on encounter cards (a picture, a story line, both or neither), chosen in the encounter card editor (owner's request, Nov 2, 2026)
  - Plan: pictures are shrunk to about 100 KB and stored once on the device; cards hold a short reference, so saves stay small. Deck files carry the pictures; a game opened without them shows the story instead. A built-in deck's pictures ship with the app. Pictures must be original (drawn, photographed or generated), never scans of the printed cards.
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
- [ ] Original faction names and theme, or neutral placeholders until the art pass?

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Rules accuracy: Scythe has many edge cases and FAQ rulings | Bugs that feel unfair or wrong | Scenario tests per rule; a rules-check log of sources; fuzz testing |
| Data entry: hundreds of cards and abilities | Slow, error-prone | Content as structured data files; validation scripts |
| Strategic AI difficulty: hidden information and a huge branching factor | Weak or slow AI | Build in layers (turn planner, position score, personalities) before search; time-boxed thinking; tune offline on the Linux machine |
| Phone performance during AI search | Hot phone, slow turns | Web Worker, time-boxed thinking, difficulty settings |
| Scope creep from polish and expansions | Never finishing | Phase gates: each phase must be playable before the next starts |

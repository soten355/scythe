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
| Automa first, strategic AI later | Bots share one interface; a smarter AI drops into the same slot |

**Scope at launch:** base game (5 factions, 5 player mats) plus Invaders from Afar (2 factions, 2 player mats), up to 7 players in any mix of humans and bots.

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
│ Human · Pass-and-play · Automa · AI  │     │
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

**Determinism.** All randomness (shuffles, Automa draws) comes from a seeded random number generator stored in state, never from the system clock or `Math.random()`. Same seed plus same actions always produces the same game.

**Testing.** Rules are verified with automated tests: scripted scenarios ("a mech with Riverwalk can cross onto a farm") and fuzz tests where bots play thousands of random legal games and the engine checks invariants (no negative resources, unit counts match, the game always ends).

## Content modules

The core engine knows the turn structure; everything else is content that a module registers. Turning an expansion on or off is a setup choice, not a code change.

**What a module can register**

- Factions: home base, starting units, faction ability, four mech abilities
- Player mats: section layout, costs, upgrade slots, starting popularity and coins
- Cards: encounter, factory, objective, combat
- Board changes and structure bonus tiles
- Rule hooks: points where a module can add or change behavior ("before combat," "on game end," "when a star is placed")
- Automa decks for its factions

| Module | Contents | When |
| --- | --- | --- |
| Core | Board, turn structure, actions, combat, scoring | Phase 1 |
| Base game | 5 factions, 5 player mats, all base cards | Phases 1–2 |
| Invaders from Afar | 2 factions, 2 player mats, their Automa cards | Phase 2 |
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
| Automa | Draws from its card deck and follows the card | Uses the official solo rules' simplified bot economy; difficulty levels follow those rules |
| Strategic AI | Searches ahead with the engine (Monte Carlo tree search), later possibly a trained model | Runs in a background thread (Web Worker) so the UI never freezes |

**Two kinds of bots.** The Automa doesn't play the full game; it follows its own simplified rules. The strategic AI plays the real game with the same rules as you. The engine supports both: Automa rules are a module, while the strategic AI simply uses `legalActions` like a human.

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
| UI | Svelte or React (decide in Phase 1) | Lightweight, reactive views of game state |
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
    bots/        automa, strategic AI
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
- [ ] Installs on iPhone and opens in airplane mode

**Phase 1: Engine core and hot-seat board**

- [ ] Board data: all hexes, terrain, rivers, lakes, tunnels, home bases
- [ ] Turn structure: choose a section, top-row action, bottom-row action, can't repeat the last section
- [ ] All four top-row and four bottom-row actions, with costs and rewards
- [ ] Movement, production, workers and resources on hexes
- [ ] 2 factions and 2 player mats
- [ ] 2D board, player mat drawer, legal-move highlighting
- [ ] Installs on iPhone and runs offline
- [ ] Done when: two humans can play a full turn cycle pass-and-play on the phone

**Phase 2: Full rules and all content**

- [ ] Combat (power dial, combat cards), retreats, popularity loss
- [ ] Mechs and all mech abilities; faction abilities
- [ ] Stars, triumph track, game end and final scoring
- [ ] Encounters, the Factory, objectives, structure bonus tiles
- [ ] All 5 base factions and 5 mats; Invaders from Afar factions and mats
- [ ] Autosave, save slots, export and import
- [ ] Done when: a complete 7-faction game can be played to final scoring and reloaded from a file

**Phase 3: Automa bots**

- [ ] Automa card deck and its simplified rules
- [ ] Difficulty levels
- [ ] Bot turn playback with skip
- [ ] Done when: a full solo game against 1–6 Automa opponents plays without errors

**Phase 4: Polish**

- [ ] Art pass, animation, sound
- [ ] Optional 3D board
- [ ] Done when: it feels like a game, not a prototype

**Phase 5: Strategic AI and campaign**

- [ ] Monte Carlo tree search bot in a Web Worker
- [ ] Self-play simulations on the Linux machine to tune or train it
- [ ] Campaign module with persistent progress
- [ ] Done when: the AI beats the Automa consistently, and a campaign can be played start to finish

## Open questions and risks

**Open questions**

- [ ] Do we have the physical game or PDF rulebooks (base, Invaders from Afar, Automa rules)? Card-by-card data entry depends on having them on hand.
- [ ] Svelte or React for the UI?
- [ ] Which two factions and mats for Phase 1?
- [ ] Original faction names and theme, or neutral placeholders until the art pass?

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Rules accuracy: Scythe has many edge cases and FAQ rulings | Bugs that feel unfair or wrong | Scenario tests per rule; a rules-check log of sources; fuzz testing |
| Data entry: hundreds of cards and abilities | Slow, error-prone | Content as structured data files; validation scripts |
| Strategic AI difficulty: hidden information and a huge branching factor | Weak or slow AI | Start with Automa; limit search depth; train offline on the Linux GPU |
| Phone performance during AI search | Hot phone, slow turns | Web Worker, time-boxed thinking, difficulty settings |
| Scope creep from polish and expansions | Never finishing | Phase gates: each phase must be playable before the next starts |

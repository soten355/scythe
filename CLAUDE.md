# Scythe PWA

**Read `docs/DESIGN.md` before starting any phase work, and tick its checklist
items (`- [ ]` → `- [x]`) as they're completed.**

## Goal
Personal offline PWA of Scythe (base game; Invaders from Afar later, in Phase 5) for iPhone
(the game always shows in landscape, however the phone is held; the menus work either way up) and Mac browser. Clean and functional first; animation,
sound and 3D later.

## Repo layout
- `packages/engine` — rules, state, actions, seeded RNG. Pure TypeScript, no DOM, no imports from app.
- `packages/content` — content modules (base, invaders-from-afar, later campaign). Data-first.
- `packages/bots` — bots that play the real game, each with its faction's personality (no Automa).
- `packages/app` — the PWA (UI, board, menus, saves). Vite + vite-plugin-pwa.
- `tools/` — simulation and balance scripts (run in Node via `tsx`).

Commands: `npm test`, `npm run typecheck`, `npm run dev`, `npm run build`, `npm run sim`.
Deploys to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`);
Vite `base` is `/scythe/`.

## Architecture rules
- The engine is a pure, deterministic function:
  `applyAction(state, action) -> newState`; `legalActions(state, seat)`;
  `isGameOver(state)`; `score(state)`.
- Game state is plain JSON-serializable data.
- A game = setup + ordered action log. Saves, autosave, undo and replays are
  all built by replaying the log.
- All randomness comes from a seeded RNG stored in state. Never use
  `Math.random()` or the clock in the engine. (`tools/src/architecture.test.ts`
  enforces this.)
- Turns are broken into small explicit actions (choose section, each sub-step,
  each cost).
- `packages/engine` imports nothing from `packages/app`.
- Every player is a "seat": `chooseAction(view, legalActions) -> Promise<Action>`.
  Human, pass-and-play and bots all use this interface. Bots
  run in Web Workers.
- Content (factions, player mats, cards, mech abilities) is registered by
  modules, described as data where possible, with rule hooks for unique
  behavior. Engine uses neutral IDs; display names, art and flavor text live
  in a swappable content pack. Use original art and wording, never the
  published game's art or card text.
- Persistence: IndexedDB autosave after every action; save slots;
  export/import `.scythe.json` save files; saves record engine version.

## Stack
TypeScript, Vite, vite-plugin-pwa, Vitest, Svelte 5 (runes syntax:
`$state`, `$derived`, `$props`; not the old Svelte 4 style), SVG for the 2D
board, Three.js later, IndexedDB, Web Workers. Keep game logic out of
components: put it in plain `.ts` files that can be unit tested.

## Testing
Every rule gets scenario tests; fuzz tests (random legal games) check
invariants. Write tests before rule code.

## Workflow
- One checklist item per session.
- Run tests before committing.
- Small commits with clear messages.
- Explain changes in plain language, since the owner directs and play-tests
  but doesn't write code.

## Current phase
Phases 0 (setup), 1 (engine core, hot-seat 2D board) and 2 (full rules and
all base-game content) — done; the board keeps evolving with play-testing.
The real encounter, Factory and objective decks and structure bonus tiles are
all built in. Next: Phase 3, bots with faction personalities (Automa dropped).

<script lang="ts">
  // The codex: browse everything new games use, one at a time and large:
  // factions, mats, encounter cards, Factory cards, objectives and structure
  // bonus tiles. Tabs pick the kind; ‹ › (or swiping, or the arrow keys)
  // step through them; the list jumps to one. What each shows comes from
  // codex.ts; the pictures from the theme and the device.
  import type { Board } from '@scythe/engine';
  import { fade, fly } from 'svelte/transition';
  import type { Catalog } from './setup';
  import { CODEX_TABS, codexList, encounterFacts, factionFacts, factoryFacts, matFacts, objectiveFacts, tileFacts, type CodexKind } from './codex';
  import { cardLook } from '../content/card-pictures';
  import { cardPicture } from '../theme/current.svelte';
  import FactionEmblem from '../play/FactionEmblem.svelte';
  import FactionPortrait from '../play/FactionPortrait.svelte';
  import FightBackdrop from '../play/FightBackdrop.svelte';
  import FighterArt from '../play/FighterArt.svelte';
  import { inkOn } from '../play/ink';

  let { catalog, builtIn, board, onBack }: { catalog: Catalog; builtIn: Catalog; board: Board; onBack: () => void } = $props();

  let kind = $state<CodexKind>('factions');
  let index = $state(0);
  /** Which way the last step went, so the page slides in from that side. */
  let direction = $state(1);

  const list = $derived(codexList(catalog, builtIn, kind));
  const count = $derived(list.items.length);
  const at = $derived(Math.min(index, Math.max(0, count - 1)));

  function pick(next: CodexKind) {
    kind = next;
    index = 0;
    direction = 1;
  }

  function step(by: number) {
    if (count < 2) return;
    direction = by;
    index = (at + by + count) % count;
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Escape') onBack();
  }

  // Swiping left or right on the page steps through.
  let startX: number | null = null;
  const down = (e: PointerEvent) => (startX = e.clientX);
  function up(e: PointerEvent) {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }

  const faction = $derived(kind === 'factions' ? catalog.factions[at] : undefined);
  const mat = $derived(kind === 'mats' ? [...catalog.mats].sort((a, b) => a.turnOrder - b.turnOrder)[at] : undefined);
  const encounter = $derived(kind === 'encounters' ? catalog.encounters?.[at] : undefined);
  const factory = $derived(kind === 'factory' ? catalog.factory?.[at] : undefined);
  const objective = $derived(kind === 'objectives' ? catalog.objectives?.[at] : undefined);
  const tile = $derived(kind === 'structureBonuses' ? catalog.structureBonuses?.[at] : undefined);
  const SAMPLE: Partial<Record<CodexKind, string>> = {
    encounters: 'Made-up sample cards until you add your own from the encounter card editor.',
    factory: 'Made-up sample cards until you add your own from the Factory card editor.',
    objectives: 'Made-up sample cards until you add your own from the objective card editor.',
    structureBonuses: 'Made-up sample tiles until you add your own from the structure bonus tile editor.',
  };
</script>

<svelte:window onkeydown={onkey} />

<div class="codex">
  <header>
    <button class="quiet" onclick={onBack}>‹ Menu</button>
    <h1>Codex</h1>
    <nav class="tabs">
      {#each CODEX_TABS as t (t.kind)}
        <button class="tab" class:on={kind === t.kind} aria-pressed={kind === t.kind} onclick={() => pick(t.kind)}><span aria-hidden="true">{t.icon}</span> {t.label}</button>
      {/each}
    </nav>
  </header>

  <main>
    <button class="arrow" aria-label="Previous" disabled={count < 2} onclick={() => step(-1)}>‹</button>
    <section class="page" role="group" aria-label="Swipe for the next or previous" onpointerdown={down} onpointerup={up} onpointercancel={() => (startX = null)} aria-live="polite">
      {#key `${kind}|${at}`}
        <div class="slide" in:fly={{ x: 40 * direction, duration: 260 }}>
          {#if count === 0}
            <p class="empty">Nothing here yet.</p>
          {:else if faction}
            {@const f = factionFacts(faction, board)}
            <div class="faction" style:--c={faction.color} style:--ink={inkOn(faction.color)}>
              <div class="hero">
                <FightBackdrop terrain={f.terrain} />
                <div class="figures">
                  <div class="mech"><FighterArt kind="mech" color={faction.color} factionId={faction.id} /></div>
                  <div class="character"><FighterArt kind="character" color={faction.color} factionId={faction.id} /></div>
                </div>
              </div>
              <div class="facts">
                <div class="named">
                  <div class="crest"><FactionEmblem {faction} /></div>
                  <FactionPortrait factionId={faction.id} color={faction.color} size={56} />
                  <div>
                    <h2>{faction.name}</h2>
                    <p class="chips">{#each f.start as s (s)}<span>{s}</span>{/each}</p>
                  </div>
                </div>
                <div class="box ability">
                  <h3>Faction ability</h3>
                  <p><b>{f.ability.name}</b> {f.ability.description}</p>
                </div>
                <div class="box">
                  <h3>Mech abilities</h3>
                  <div class="grid2">
                    {#each f.mechAbilities as m, i (i)}<p><b>{m.name}</b> {m.description}</p>{/each}
                  </div>
                </div>
                <div class="box">
                  <h3>Recruits: one-time bonuses</h3>
                  <p class="chips">{#each f.recruits as r, i (i)}<span>{r}</span>{/each}</p>
                </div>
              </div>
            </div>
          {:else if mat}
            {@const m = matFacts(mat)}
            <div class="mat">
              <div class="named">
                <h2>{m.title}</h2>
                <p class="chips">{#each m.start as s (s)}<span>{s}</span>{/each}</p>
              </div>
              <div class="sections">
                {#each m.sections as s, i (i)}
                  <div class="section">
                    <div class="half top">
                      <h3>{s.top}</h3>
                      {#each s.topLines as line (line)}<p>{line}</p>{/each}
                      <p class="dim">🏛️ Build the {s.structure} here</p>
                    </div>
                    <div class="half bottom">
                      <h3>{s.bottom}</h3>
                      {#each s.bottomLines as line (line)}<p>{line}</p>{/each}
                      <p class="dim">With its recruit: +1 {s.recruit} whenever you or a neighbour takes {s.bottom}</p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else if encounter}
            {@const e = encounterFacts(encounter)}
            {@const shown = cardLook(encounter, cardPicture(encounter.picture))}
            <div class="encounter">
              <h2>⭐ {encounter.name}</h2>
              {#if shown.picture}
                <div class="card-picture" style:background-image="url({shown.picture})">
                  {#if shown.story}<p class="story">{shown.story}</p>{/if}
                </div>
              {:else if shown.story}
                <p class="story plain">{shown.story}</p>
              {/if}
              <div class="options">
                {#each e.options as o, i (i)}
                  <div class="option">
                    <span class="text">{o.text}</span>
                    <span class="cost">{o.cost}</span>
                    <span class="gain">{o.gain}</span>
                  </div>
                {/each}
              </div>
            </div>
          {:else if factory}
            {@const c = factoryFacts(factory)}
            <div class="paper factory">
              <h2>🏭 {factory.name}</h2>
              <p class="part">Top</p>
              <p>{c.top}</p>
              <p class="part">Then</p>
              <p>{c.move}</p>
            </div>
          {:else if objective}
            {@const o = objectiveFacts(objective)}
            <div class="paper objective">
              <h2>🎯 {objective.name}</h2>
              {#if o.story}<p class="story">{o.story}</p>{/if}
              <p class="big">{o.text}</p>
              {#if o.endOfTurn}<p class="part">Only at the end of your turn</p>{/if}
            </div>
          {:else if tile}
            {@const t = tileFacts(tile)}
            <div class="paper tile">
              <h2>🏛️ {tile.name}</h2>
              <p class="big">{t.count}</p>
              <p class="part">At the end of the game, whatever your popularity</p>
              <p class="chips dark">{#each t.pays as p (p)}<span>{p}</span>{/each}</p>
            </div>
          {/if}
        </div>
      {/key}
    </section>
    <button class="arrow" aria-label="Next" disabled={count < 2} onclick={() => step(1)}>›</button>
  </main>

  <footer>
    {#if count}
      <select value={at} onchange={(e) => ((direction = 1), (index = Number(e.currentTarget.value)))} aria-label="Go to">
        {#each list.items as item, i (item.id)}<option value={i}>{item.name}</option>{/each}
      </select>
      <span class="where">{at + 1} of {count}</span>
    {/if}
    {#if list.sample}<span class="sample" transition:fade>{SAMPLE[kind]}</span>{/if}
  </footer>
</div>

<style>
  .codex {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 20px;
    letter-spacing: 0.08em;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-left: auto;
    min-width: 0;
    overflow-x: auto;
  }
  .tab {
    white-space: nowrap;
  }
  button {
    font: inherit;
    color: var(--fg);
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 5px 10px;
    cursor: pointer;
  }
  button.quiet {
    background: none;
    border-color: transparent;
    color: var(--accent);
  }
  .tab.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 700;
  }
  main {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    gap: 6px;
    padding: 0 6px;
  }
  .arrow {
    flex: none;
    width: 40px;
    font-size: 28px;
    padding: 0;
    background: color-mix(in srgb, var(--raised) 60%, transparent);
  }
  .arrow:disabled {
    opacity: 0.25;
  }
  .page {
    flex: 1;
    min-width: 0;
    position: relative;
    overflow: hidden;
    touch-action: pan-y;
  }
  .slide {
    position: absolute;
    inset: 0;
    overflow-y: auto;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    font-size: 13px;
  }
  footer select {
    font: inherit;
    color: var(--fg);
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 4px 6px;
    max-width: 40%;
  }
  .where,
  .sample {
    opacity: 0.65;
  }
  .sample {
    margin-left: auto;
    font-style: italic;
  }
  .empty {
    text-align: center;
    opacity: 0.6;
    margin-top: 20vh;
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.65;
  }
  p {
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .chips span {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--line);
  }
  .chips.dark span {
    background: rgb(0 0 0 / 0.08);
    border-color: rgb(0 0 0 / 0.25);
  }
  .named {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .box {
    background: var(--panel);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 13px;
  }
  .box.ability {
    border-left: 3px solid var(--c);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
  }

  /* A phone held sideways: one slim row of tabs, thinner arrows, more room for the page. */
  @media (max-height: 500px) {
    h1 {
      display: none;
    }
    header {
      padding: 4px 6px;
      gap: 6px;
      flex-wrap: nowrap;
    }
    .tab {
      font-size: 12px;
      padding: 4px 7px;
    }
    .arrow {
      width: 28px;
      font-size: 22px;
    }
    footer {
      padding: 4px 8px;
    }
  }

  /* A faction: its two figures in the land by its home base, and its facts beside them. */
  .faction {
    display: flex;
    gap: 10px;
    height: 100%;
  }
  .hero {
    position: relative;
    width: 40%;
    flex: none;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid var(--c);
  }
  .figures {
    position: absolute;
    inset: 0;
  }
  .figures .mech,
  .figures .character {
    position: absolute;
    bottom: 18%;
  }
  .figures .mech {
    left: 4%;
    width: 50%;
    height: 66%;
  }
  .figures .character {
    right: 6%;
    width: 38%;
    height: 50%;
  }
  .facts {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }
  .faction h2 {
    color: color-mix(in srgb, var(--c) 60%, white);
  }
  .crest {
    width: 56px;
    height: 56px;
    flex: none;
  }

  /* A mat: its four sections side by side, as on the table. */
  .mat {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sections {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .section {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--line);
    font-size: 13px;
  }
  .half {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .half.top {
    background: var(--raised);
  }
  .half.bottom {
    background: var(--panel);
    flex: 1;
  }
  .half h3 {
    font-size: 14px;
    opacity: 1;
    color: var(--accent);
  }
  .dim {
    opacity: 0.65;
    font-size: 12px;
  }

  /* An encounter card, as it appears in a game. */
  .encounter {
    max-width: 760px;
    margin: 0 auto;
    background: var(--panel);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card-picture {
    height: clamp(90px, 34vh, 260px);
    border-radius: 8px;
    background: center / cover no-repeat;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }
  .story {
    font-style: italic;
  }
  .card-picture .story {
    width: 100%;
    padding: 18px 10px 6px;
    color: #fff;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
    background: linear-gradient(transparent, rgb(0 0 0 / 0.65));
  }
  .story.plain {
    opacity: 0.85;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .option {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    background: var(--raised);
    border: 1px solid var(--line);
    font-size: 14px;
  }
  .option .cost {
    font-weight: 700;
  }
  .option .gain {
    opacity: 0.85;
  }

  /* Factory cards, objectives and tiles: paper, like the round card. */
  .paper {
    max-width: 460px;
    margin: 4vh auto 0;
    padding: 16px 18px;
    border-radius: 10px;
    background: #e9dcc0;
    color: #2a241e;
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.45);
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 15px;
  }
  .paper h2 {
    font-size: 22px;
    color: #2a241e;
  }
  .paper .part {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.6;
    margin-top: 4px;
  }
  .paper .big {
    font-size: 17px;
  }
</style>

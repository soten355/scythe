<script lang="ts">
  // A faction's own screen, opened by tapping its name in the top bar: its
  // character and a mech standing in the scenery of the character's hex, its
  // crest, and everything about how it's doing (numbers, the ways to a star,
  // what it has on the map, abilities, recruits, structures, cards and what it
  // would score if the game ended now). Tabs along the top switch between
  // factions. Only what the table could see (see dossier.ts). Placeholder art
  // for now (FighterArt, FightBackdrop, FactionEmblem), swapped in the art pass.
  import type { GameState } from '@scythe/engine';
  import { fade, fly } from 'svelte/transition';
  import FactionEmblem from './FactionEmblem.svelte';
  import FactionPortrait from './FactionPortrait.svelte';
  import FightBackdrop from './FightBackdrop.svelte';
  import FighterArt from './FighterArt.svelte';
  import InlineIcon from './InlineIcon.svelte';
  import { BONUS_ICONS, RESOURCE_ICONS, STAR_KIND_ICONS, STRUCTURE_ICONS } from './icons';
  import { dossierOf } from './dossier';
  import { inkOn } from './ink';

  let {
    game,
    seat,
    secret,
    playedBy,
    leaning,
    onSwitch,
    onClose,
  }: {
    game: GameState;
    seat: number;
    /** Hide `seat`'s combat cards and objectives in hand (not the viewer's own). */
    secret: (seat: number) => boolean;
    /** "You", "A person", "Medium bot". */
    playedBy: (seat: number) => string;
    /** A bot's leaning, in a line. */
    leaning: (seat: number) => string | undefined;
    onSwitch: (seat: number) => void;
    onClose: () => void;
  } = $props();

  const d = $derived(dossierOf(game, seat, { secret: secret(seat) }));
  const faction = $derived(game.setup.players[seat]!.faction);
  const terrain = $derived(game.players[seat]!.character === 'home' ? 'tundra' : (game.setup.board.hexes[game.players[seat]!.character]?.terrain ?? 'tundra'));
  const ACTION_NAMES: Record<string, string> = { upgrade: 'Upgrade', deploy: 'Deploy', build: 'Build', enlist: 'Enlist' };
  const STRUCTURE_NAMES: Record<string, string> = { mine: 'Mine', mill: 'Mill', armory: 'Armory', monument: 'Monument' };
  const BONUS_NAMES: Record<string, string> = { power: 'power', coins: 'coin', popularity: 'popularity', combatCard: 'combat card' };
  const placeName = (n: number) => ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][n - 1] ?? `${n}th`;
  const pct = (have: number, of: number) => `${Math.round((100 * have) / Math.max(1, of))}%`;

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="dossier" role="dialog" aria-modal="true" aria-label="{d.name}: how they're doing" style:--c={d.color} style:--ink={inkOn(d.color)} transition:fade={{ duration: 220 }}>
  <div class="scene" aria-hidden="true"><FightBackdrop {terrain} /></div>
  <div class="shade" aria-hidden="true"></div>

  <nav class="tabs">
    {#each game.setup.players as p, s (s)}
      <button class="tab" class:on={s === seat} style:--t={p.faction.color} style:--t-ink={inkOn(p.faction.color)} onclick={() => onSwitch(s)} aria-pressed={s === seat}>
        {p.faction.name}
      </button>
    {/each}
    <button class="close" onclick={onClose} aria-label="Close">✕</button>
  </nav>

  {#key seat}
    <section class="hero" in:fly={{ x: -30, duration: 380 }}>
      <div class="heading">
        <div class="crest"><FactionEmblem {faction} /></div>
        <FactionPortrait factionId={faction.id} color={d.color} size={72} />
        <div>
          <h2>{d.name}</h2>
          <p class="sub">{d.mat} mat (#{d.matNumber}) · {playedBy(seat)}</p>
          {#if leaning(seat)}<p class="leaning">{leaning(seat)}</p>{/if}
        </div>
      </div>
      <div class="figures">
        <div class="mech"><FighterArt kind="mech" color={d.color} factionId={faction.id} facing="right" /></div>
        <div class="character"><FighterArt kind="character" color={d.color} factionId={faction.id} facing="right" /></div>
      </div>
    </section>

    <section class="facts" in:fly={{ x: 30, duration: 380, delay: 60 }}>
      <div class="card headline">
        <div class="stars" aria-label="{d.stars.placed} of {d.stars.of} stars">
          {#each Array.from({ length: d.stars.of }) as _, i (i)}<span class="star" class:lit={i < d.stars.placed} style:--i={i}>★</span>{/each}
        </div>
        <div class="standing">
          <span class="total">{d.standing.total}<small>&nbsp;coins</small></span>
          <span class="place">{placeName(d.standing.place)} of {d.standing.of} if the game ended now</span>
        </div>
        <ul class="lines">
          {#each d.standing.lines as l (l.label)}<li><span>{l.label}</span><b>{l.coins}</b></li>{/each}
        </ul>
      </div>

      <div class="card">
        <h3>Treasury</h3>
        <div class="big-numbers">
          <span><InlineIcon icon={BONUS_ICONS.coins} /> <b>{d.stats.coins}</b> coins</span>
          <span><InlineIcon icon={BONUS_ICONS.combatCard} /> <b>{d.stats.combatCards}</b> combat cards</span>
        </div>
        {#if d.stats.cardValues}
          <div class="cards">{#each d.stats.cardValues as v, i (i)}<span class="combat-card">{v}</span>{/each}</div>
        {/if}
        <div class="meter">
          <span class="label"><InlineIcon icon={BONUS_ICONS.power} /> Power <b>{d.stats.power}</b>/{d.stats.maxPower}</span>
          <span class="bar"><span class="fill" style:--w={pct(d.stats.power, d.stats.maxPower)}></span></span>
        </div>
        <div class="meter">
          <span class="label"><InlineIcon icon={BONUS_ICONS.popularity} /> Popularity <b>{d.stats.popularity}</b>/{d.stats.maxPopularity}</span>
          <span class="bar tiers"><span class="fill" style:--w={pct(d.stats.popularity, d.stats.maxPopularity)}></span></span>
          <small>Tier {d.stats.tier.number} ({d.stats.tier.range}): {d.stats.tier.rates}</small>
        </div>
      </div>

      <div class="card">
        <h3>Ways to a star</h3>
        <ul class="goals">
          {#each d.goals as g (g.kind)}
            <li class:earned={g.earned > 0}>
              <span class="icon"><InlineIcon icon={STAR_KIND_ICONS[g.kind]} /></span>
              <span class="name">{g.label}</span>
              <span class="bar"><span class="fill" style:--w={pct(g.have, g.need)}></span></span>
              <span class="count">{g.have}/{g.need}{g.earned ? ' ' + '★'.repeat(g.earned) : ''}</span>
            </li>
          {/each}
        </ul>
      </div>

      <div class="card">
        <h3>On the map</h3>
        <ul class="plain">
          <li><span>Character</span><b>{d.units.character}</b></li>
          <li><span>Mechs</span><b>{d.units.mechs}/4</b></li>
          <li><span>Workers</span><b>{d.units.workers}/8</b></li>
          <li><span>Territories</span><b>{d.units.territories}</b></li>
        </ul>
        <div class="resources">
          {#each Object.entries(d.resources) as [r, n] (r)}<span class:none={!n}><InlineIcon icon={RESOURCE_ICONS[r as 'oil']} /> {n} {r}</span>{/each}
        </div>
      </div>

      <div class="card wide">
        <h3>Abilities</h3>
        <p class="ability"><b>{d.ability.name}</b> {d.ability.description}</p>
        <ul class="mech-abilities">
          {#each d.mechAbilities as m (m.name)}
            <li class:locked={!m.unlocked}><b>{m.unlocked ? '🤖' : '🔒'} {m.name}</b> {m.description}</li>
          {/each}
        </ul>
      </div>

      <div class="card">
        <h3>Recruits</h3>
        <ul class="plain">
          {#each d.recruits as r (r.action)}
            <li class:dim={!r.placed}>
              <span>{r.placed ? '🎖️' : '○'} {ACTION_NAMES[r.action]}</span>
              <b>+1 <InlineIcon icon={BONUS_ICONS[r.bonus]} /></b>
            </li>
          {/each}
        </ul>
        <p class="note">A recruit pays its bonus whenever this player or a neighbour takes that action.</p>
        <div class="one-time">
          {#each d.oneTime as b (b.bonus)}
            <span class:taken={b.taken} title={b.taken ? 'Taken' : 'Still to take'}>{b.taken ? '✓' : ''} +{b.amount} {BONUS_NAMES[b.bonus]}{b.amount > 1 && b.bonus !== 'popularity' && b.bonus !== 'power' ? 's' : ''}</span>
          {/each}
        </div>
      </div>

      <div class="card">
        <h3>Structures · upgrades</h3>
        <ul class="plain">
          {#each d.structures as s (s.kind)}
            <li class:dim={!s.hex}><span><InlineIcon icon={STRUCTURE_ICONS[s.kind]} /> {STRUCTURE_NAMES[s.kind]}</span><b>{s.hex ?? 'not built'}</b></li>
          {/each}
          <li><span>⬆️ Upgrades</span><b>{d.upgrades.done}/{d.upgrades.of}</b></li>
        </ul>
      </div>

      {#if d.factoryCard || d.objectives.hidden || d.objectives.shown.length}
        <div class="card">
          <h3>Cards</h3>
          {#if d.factoryCard}<p>🏭 Factory card: <b>{d.factoryCard}</b></p>{/if}
          {#each d.objectives.shown as o (o.name)}
            <p class="objective {o.status}">🎯 <b>{o.name}</b>{o.status === 'done' ? ' ✓ completed' : o.status === 'ready' ? ' (ready)' : ''}<br /><small>{o.text}</small></p>
          {/each}
          {#if d.objectives.hidden}<p class="dim">🎯 {d.objectives.hidden} objective card{d.objectives.hidden > 1 ? 's' : ''}, face down</p>{/if}
        </div>
      {/if}
    </section>
  {/key}
</div>

<style>
  .dossier {
    position: fixed;
    inset: 0;
    z-index: 15;
    display: grid;
    grid-template-columns: minmax(220px, 34%) 1fr;
    grid-template-rows: auto 1fr;
    background: var(--bg);
    overflow: hidden;
    padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
  }
  .scene,
  .shade {
    position: absolute;
    inset: 0;
  }
  .scene :global(svg) {
    width: 100%;
    height: 100%;
  }
  /* Clear behind the character, darker behind the facts so they read. */
  .shade {
    background:
      linear-gradient(90deg, transparent 0%, rgb(20 16 12 / 0.35) 30%, rgb(20 16 12 / 0.86) 48%, rgb(20 16 12 / 0.92) 100%),
      linear-gradient(0deg, color-mix(in srgb, var(--c) 22%, transparent), transparent 40%);
  }
  .tabs {
    grid-column: 1 / -1;
    position: relative;
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    align-items: center;
    overflow-x: auto;
  }
  .tab {
    padding: 4px 12px;
    border-radius: 99px;
    border: 2px solid var(--t);
    background: rgb(20 16 12 / 0.7);
    color: color-mix(in srgb, var(--t) 55%, white);
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
  }
  .tab.on {
    background: var(--t);
    color: var(--t-ink);
  }
  .close {
    margin-left: auto;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgb(20 16 12 / 0.75);
    font-size: 16px;
    flex: none;
  }
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 10px 0 14px;
  }
  .heading {
    display: flex;
    gap: 10px;
    align-items: center;
    text-shadow: 0 2px 6px rgb(0 0 0 / 0.8);
  }
  .crest {
    width: 64px;
    height: 64px;
    flex: none;
    filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.6));
  }
  h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: clamp(24px, 5cqh, 38px);
    color: color-mix(in srgb, var(--c) 45%, white);
  }
  .sub,
  .leaning {
    margin: 2px 0 0;
    font-size: 12px;
  }
  .leaning {
    font-style: italic;
    opacity: 0.85;
  }
  /* The character in front, a mech over its shoulder, on the scenery's ground line. */
  .figures {
    position: relative;
    container-type: size;
    flex: 1;
    min-height: 0;
  }
  .figures > div {
    position: absolute;
    bottom: 4%;
  }
  /* Sized by the column's width, and kept short enough to fit its height. */
  .character {
    left: 2%;
    width: min(46%, 60cqh);
    aspect-ratio: 200 / 260;
    animation: rise 0.6s ease-out both;
  }
  .mech {
    left: 44%;
    width: min(54%, 66cqh);
    aspect-ratio: 200 / 260;
    opacity: 0.92;
    animation: rise 0.6s ease-out 0.12s both;
  }
  .figures :global(svg) {
    width: 100%;
    height: 100%;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
  }
  .facts {
    position: relative;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 10px 14px 4px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 8px;
    align-content: start;
  }
  .card {
    background: rgb(42 36 30 / 0.88);
    border: 1px solid rgb(255 246 220 / 0.12);
    border-top: 3px solid var(--c);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
  }
  .card.wide,
  .card.headline {
    grid-column: 1 / -1;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
  }
  .headline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 18px;
  }
  .stars {
    display: flex;
    gap: 2px;
    font-size: 26px;
    line-height: 1;
  }
  .star {
    color: rgb(255 246 220 / 0.18);
  }
  .star.lit {
    color: #ffd75e;
    text-shadow: 0 0 8px rgb(255 200 60 / 0.5);
    animation: pop 0.35s ease-out calc(0.2s + var(--i) * 0.08s) both;
  }
  @keyframes pop {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }
  .standing {
    display: flex;
    flex-direction: column;
  }
  .total {
    font-size: 24px;
    font-weight: 800;
  }
  .total small {
    font-size: 13px;
    font-weight: 400;
  }
  .place {
    font-size: 12px;
    opacity: 0.8;
  }
  .lines {
    flex: 1;
    min-width: 200px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    columns: 2;
    column-gap: 18px;
  }
  .lines li,
  .plain li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .plain {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 3px;
  }
  .big-numbers {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }
  .big-numbers b {
    font-size: 18px;
  }
  .cards {
    display: flex;
    gap: 4px;
    margin: 6px 0 2px;
  }
  .combat-card {
    width: 22px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    background: #e9dcc0;
    color: #1e1a16;
    font-weight: 800;
  }
  .meter {
    display: grid;
    gap: 3px;
    margin-top: 8px;
  }
  .meter small {
    opacity: 0.75;
    font-size: 11px;
  }
  .bar {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: rgb(255 246 220 / 0.1);
    overflow: hidden;
  }
  .fill {
    position: absolute;
    inset: 0;
    width: var(--w);
    background: var(--c);
    border-radius: 4px;
    transform-origin: left;
    animation: grow 0.6s ease-out 0.2s both;
  }
  /* Popularity's three tiers: marks at 7 and 13 of 18. */
  .bar.tiers {
    background:
      linear-gradient(90deg, transparent calc(100% * 7 / 18 - 1px), rgb(255 246 220 / 0.5) 0 calc(100% * 7 / 18 + 1px), transparent 0),
      linear-gradient(90deg, transparent calc(100% * 13 / 18 - 1px), rgb(255 246 220 / 0.5) 0 calc(100% * 13 / 18 + 1px), transparent 0),
      rgb(255 246 220 / 0.1);
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
  .goals {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 4px;
  }
  .goals li {
    display: grid;
    grid-template-columns: 20px 92px 1fr 56px;
    align-items: center;
    gap: 6px;
  }
  .goals .count {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .goals li.earned .name,
  .goals li.earned .count {
    color: #ffd75e;
    font-weight: 700;
  }
  .goals li.earned .fill {
    background: #ffd75e;
  }
  .resources,
  .one-time {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 6px;
  }
  .none,
  .dim {
    opacity: 0.5;
  }
  .one-time span {
    padding: 1px 8px;
    border-radius: 99px;
    border: 1px dashed rgb(255 246 220 / 0.35);
    font-size: 12px;
  }
  .one-time .taken {
    border-style: solid;
    background: var(--c);
    color: var(--ink);
  }
  .note {
    margin: 6px 0 0;
    font-size: 11px;
    opacity: 0.7;
  }
  .ability {
    margin: 0 0 6px;
  }
  .mech-abilities {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 4px 12px;
  }
  .locked {
    opacity: 0.55;
  }
  .card p {
    margin: 0 0 4px;
  }
  .objective.ready b {
    color: #ffd75e;
  }
  @media (prefers-reduced-motion: reduce) {
    .character,
    .mech,
    .star.lit,
    .fill {
      animation: none;
    }
  }
</style>

<script lang="ts">
  // The workshop: every editor and tool, grouped, each with what it's for.
  // Each opens as its own page; their back links return here (index.html#workshop).
  let { onBack }: { onBack: () => void } = $props();
  const base = import.meta.env.BASE_URL;

  const GROUPS: { title: string; tools: { page: string; icon: string; name: string; what: string }[] }[] = [
    {
      title: 'Board and factions',
      tools: [
        { page: 'editor.html', icon: '🗺️', name: 'Map editor', what: 'Hexes, terrain, rivers and home bases' },
        { page: 'mats.html', icon: '📋', name: 'Mat editor', what: 'Player mats: actions, costs and bonuses' },
        { page: 'factions.html', icon: '🛡️', name: 'Faction editor', what: 'Power, cards, abilities and recruits' },
      ],
    },
    {
      title: 'Cards and tiles',
      tools: [
        { page: 'encounters.html', icon: '📜', name: 'Encounter cards', what: 'The encounter deck' },
        { page: 'factory.html', icon: '🏭', name: 'Factory cards', what: 'The Factory deck' },
        { page: 'objectives.html', icon: '🎯', name: 'Objective cards', what: 'The objective deck' },
        { page: 'structure-bonuses.html', icon: '🏛️', name: 'Structure bonus tiles', what: 'End-of-game structure scoring' },
      ],
    },
    {
      title: 'Look and testing',
      tools: [
        { page: 'themes.html', icon: '🎨', name: 'Theme editor', what: 'Your own pictures and colours' },
        { page: 'skin-words.html', icon: '✍️', name: 'Names and wording', what: "The skin's names for factions, mats and maps" },
        { page: 'bot-check.html', icon: '⏱️', name: 'Bot speed check', what: 'How fast bots think on this device' },
      ],
    },
  ];
</script>

<div class="workshop">
  <header>
    <button class="back" onclick={onBack}>‹ Main menu</button>
    <h1>Workshop</h1>
  </header>
  <div class="groups">
    {#each GROUPS as g (g.title)}
      <section>
        <h2>{g.title}</h2>
        <div class="tools">
          {#each g.tools as t (t.page)}
            <a class="tool" href="{base}{t.page}">
              <span class="icon" aria-hidden="true">{t.icon}</span>
              <span class="text"><b>{t.name}</b><small>{t.what}</small></span>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .workshop {
    width: min(900px, 100%);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 14px;
    box-sizing: border-box;
    overflow-y: auto;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  h1 {
    font-size: 26px;
    letter-spacing: 0.06em;
  }
  .back {
    font: inherit;
    font-size: 14px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--raised);
    color: var(--fg);
    cursor: pointer;
  }
  .groups {
    display: grid;
    gap: 12px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.65;
  }
  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }
  .tool {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--panel);
    border: 1px solid rgb(201 162 39 / 0.35);
    color: var(--fg);
    text-decoration: none;
  }
  .tool:active,
  .tool:hover {
    border-color: var(--accent);
    background: var(--raised);
  }
  .icon {
    font-size: 24px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .text b {
    color: var(--accent);
    font-size: 14px;
  }
  .text small {
    font-size: 12px;
    opacity: 0.7;
  }
</style>

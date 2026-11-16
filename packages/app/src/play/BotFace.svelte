<script lang="ts" module>
  // A bot's face in the side panel while it plays: after its crest glows, its
  // picture fades in, as if we're watching it think. Its portrait, if it has
  // one, fills the whole panel behind the words, slowly drifting and
  // breathing, as if the character were there thinking aloud. Without one,
  // its character's standing figure (else its map piece) stands below the
  // words. Nothing at all without any of them (the panel then lists its moves
  // as before).
  import { factionPicture } from '../theme/current.svelte';

  /** Which picture to show for a bot, if any: its portrait (filling the panel), else character, else its map piece. */
  export function botFace(factionId: string): { picture: string; full: boolean } | undefined {
    const portrait = factionPicture(factionId, 'portrait');
    if (portrait) return { picture: portrait, full: true };
    const figure = factionPicture(factionId, 'character') ?? factionPicture(factionId, 'characterMap');
    return figure ? { picture: figure, full: false } : undefined;
  }
</script>

<script lang="ts">
  let { face, color }: { face: { picture: string; full: boolean }; color: string } = $props();
</script>

{#if face.full}
  <div class="portrait" style:--c={color} aria-hidden="true">
    <img src={face.picture} alt="" />
  </div>
{:else}
  <div class="face" style:--c={color}><img src={face.picture} alt="" /></div>
{/if}

<style>
  /* The portrait: the whole panel, under the words. */
  .portrait {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--c) 35%, #1e1a16);
    opacity: 0;
    animation: face-in 0.9s ease-out 1.1s forwards;
    pointer-events: none;
  }
  .portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Faces sit a little above the middle: keep them in view on a tall panel. */
    object-position: 50% 30%;
    animation: drift 14s ease-in-out 1.1s infinite alternate;
  }
  /* Darker at the top and bottom, where the words and the Skip button sit; a glow of the faction's colour at the edge. */
  .portrait::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(rgb(0 0 0 / 0.75), rgb(0 0 0 / 0.15) 32%, transparent 50%, rgb(0 0 0 / 0.15) 72%, rgb(0 0 0 / 0.7)),
      linear-gradient(90deg, color-mix(in srgb, var(--c) 30%, transparent), transparent 18%);
  }
  /* Slowly closer and a touch aside, breathing: alive, not a still. */
  @keyframes drift {
    0% { transform: scale(1.04) translate(0, 0); }
    50% { transform: scale(1.09) translate(-1.5%, -1%); }
    100% { transform: scale(1.06) translate(1.5%, 0.5%); }
  }

  /* The standing figure, below the words. */
  .face {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 8px 0;
    opacity: 0;
    animation:
      face-in 0.9s ease-out 1.1s forwards,
      breathe 4.5s ease-in-out 2s infinite;
    pointer-events: none;
    /* Sized to the space left in the panel, however short (a phone held sideways). */
    container-type: size;
  }
  .face img {
    max-width: 100cqw;
    max-height: 100cqh;
    object-fit: contain;
    filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.5));
  }
  @keyframes face-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  @keyframes breathe {
    50% { transform: scale(1.025); }
  }
  @media (prefers-reduced-motion: reduce) {
    .face,
    .portrait {
      animation: face-in 0.6s ease-out 0.3s forwards;
    }
    .portrait img {
      animation: none;
    }
  }
</style>

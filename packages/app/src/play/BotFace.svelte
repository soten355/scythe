<script lang="ts" module>
  // A bot's face in the side panel while it plays: after its crest glows, its
  // picture fades in, gently breathing, as if we're watching it think. Its
  // portrait (a face, in a ring of its colour) if it has one, else its
  // character's standing figure, else the character's map piece. Nothing at
  // all without any of them (the panel then lists its moves as before).
  import { factionPicture } from '../theme/current.svelte';

  /** Which picture to show for a bot, if any: portrait, else character, else its map piece. */
  export function botFace(factionId: string): { picture: string; round: boolean } | undefined {
    const portrait = factionPicture(factionId, 'portrait');
    if (portrait) return { picture: portrait, round: true };
    const figure = factionPicture(factionId, 'character') ?? factionPicture(factionId, 'characterMap');
    return figure ? { picture: figure, round: false } : undefined;
  }
</script>

<script lang="ts">
  let { face, color }: { face: { picture: string; round: boolean }; color: string } = $props();
</script>

<div class="face" class:round={face.round} style:--c={color}><img src={face.picture} alt="" /></div>

<style>
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
  }
  /* Sized to the space left in the panel, however short (a phone held sideways). */
  .face {
    container-type: size;
  }
  img {
    max-width: 100cqw;
    max-height: 100cqh;
    object-fit: contain;
    filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.5));
  }
  .round img {
    width: min(100cqmin, 220px);
    height: min(100cqmin, 220px);
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--c);
    box-shadow: 0 0 24px color-mix(in srgb, var(--c) 45%, transparent);
    background: color-mix(in srgb, var(--c) 35%, #1e1a16);
    box-sizing: border-box;
  }
  @keyframes face-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  @keyframes breathe {
    50% { transform: scale(1.025); }
  }
  @media (prefers-reduced-motion: reduce) {
    .face {
      animation: face-in 0.6s ease-out 0.3s forwards;
    }
  }
</style>

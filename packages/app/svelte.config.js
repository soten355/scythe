import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Lets Svelte components use TypeScript.
export default {
  preprocess: vitePreprocess(),
};

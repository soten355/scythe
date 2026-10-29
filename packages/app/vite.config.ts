import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /<repo-name>/.
const base = '/scythe/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // play.html is the game; editor.html, mats.html and factions.html are the map, player mat and faction editors.
      input: { main: 'index.html', play: 'play.html', editor: 'editor.html', mats: 'mats.html', factions: 'factions.html' },
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Scythe',
        short_name: 'Scythe',
        description: 'Personal offline edition of Scythe.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#1e1a16',
        theme_color: '#1e1a16',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything so the whole app works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
      },
    }),
  ],
});

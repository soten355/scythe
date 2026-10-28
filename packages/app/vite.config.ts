import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /<repo-name>/.
const base = '/scythe/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // editor.html is the map editor, used to enter board layouts.
      input: { main: 'index.html', editor: 'editor.html' },
    },
  },
  plugins: [
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

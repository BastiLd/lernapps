import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = import.meta.dirname;

// GitHub Pages serves the site under /<repo-name>/. The deploy workflow sets BASE_PATH accordingly.
const BUILD_BASE = process.env.BASE_PATH || '/lernapps/';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : BUILD_BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Lernapps – Lernen für die Schule',
        short_name: 'Lernapps',
        description: 'Lern-Apps für die Schule: Länder, Flaggen, Hauptstädte, Sprachen, Geschichte und Kultur.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Länder der Welt', short_name: 'Länder', url: 'laender/' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        laender: resolve(root, 'laender/index.html'),
      },
    },
    // Flags are loaded as separate files (lazy, cacheable) instead of being inlined into the JS.
    assetsInlineLimit: (file) => (file.replace(/\\/g, '/').includes('/data/flags/') ? false : undefined),
    chunkSizeWarningLimit: 1500,
  },
}));

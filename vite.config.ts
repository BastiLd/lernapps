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
        background_color: '#f4f1ea',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Länder der Welt', short_name: 'Länder', url: 'laender/' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['geo/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // Detailed country outlines (public/geo, ~34 MB in total) are cached as they are used, not up front.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/geo/'),
            handler: 'CacheFirst',
            options: { cacheName: 'geo-detail', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  server: {
    // Thousands of data files, often in OneDrive: watching them only costs time (and OneDrive locks can crash the watcher).
    watch: { ignored: ['**/public/geo/**', '**/data-src/**'] },
  },
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

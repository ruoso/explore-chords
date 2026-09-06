import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Project-subpath deploy: ruoso.github.io/explore-chords/
  // This fixes asset URLs AND the service worker scope, so it must be correct
  // from the first deploy rather than at the end (see docs/DESIGN.md §3.1).
  base: '/explore-chords/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      // The app is small and makes no runtime network calls, so everything is
      // precached: once loaded it works with no network at all (§7).
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Any navigation falls back to the app shell, so a deep link works
        // offline as well as online.
        navigateFallback: '/explore-chords/index.html',
        cleanupOutdatedCaches: true,
        // Every bit of app state lives in the query string (§8.1), so a shared
        // link is `/explore-chords/?c=Am7&...`. Workbox only ignores utm-style
        // parameters by default, which means such a URL would miss the cached
        // shell and fail offline. Ignore all of them for cache matching.
        ignoreURLParametersMatching: [/.*/],
        // Take control of the page as soon as the worker activates, so the
        // first visit is already offline-capable. skipWaiting stays off: an
        // update must still ask before replacing what someone is using (§7).
        clientsClaim: true,
        skipWaiting: false,
      },
      manifest: {
        name: 'Explore Chords',
        short_name: 'Chords',
        description:
          'Chord fingerings for fretted instruments with arbitrary tunings. Works offline.',
        id: '/explore-chords/',
        start_url: '/explore-chords/',
        scope: '/explore-chords/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#fbfbf9',
        theme_color: '#7a4b2a',
        categories: ['music', 'education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  // Project-subpath deploy: ruoso.github.io/explore-chords/
  // This fixes asset URLs AND the service worker scope, so it must be correct
  // from the first deploy rather than at the end (see docs/DESIGN.md §3.1).
  base: '/explore-chords/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});

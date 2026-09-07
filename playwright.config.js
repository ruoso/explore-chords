import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration (docs/DESIGN.md §9.4).
 *
 * Two projects, because mobile-first is a stated goal and the layouts genuinely
 * differ. These tests cover journeys, wiring, persistence and accessibility —
 * never whether Cmaj7 has a major 7th, which is a unit test.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/explore-chords/',
    trace: 'on-first-retry',
    // The app follows the browser's language, and the specs assert on the
    // English text. Pinned so a Portuguese machine does not fail them all;
    // the other languages have their own spec.
    locale: 'en-US',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // Serve the already-built app: the build runs in the `test:e2e` script, so
    // it happens once rather than racing this readiness check.
    //
    // Bind explicitly to 127.0.0.1. Vite serves "localhost", which resolves to
    // ::1 on some hosts while the check below polls IPv4, and the server then
    // looks like it never started.
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/explore-chords/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

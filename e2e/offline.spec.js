import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord, appState } from './helpers.js';

/**
 * Offline behaviour (docs/DESIGN.md §7, §9.4).
 *
 * Only Playwright can exercise this: jsdom has no service worker, so the
 * offline guarantee is otherwise untestable and would quietly rot.
 */

/**
 * Wait until the app is genuinely offline-capable.
 *
 * "Active and controlling the page" is not enough: a worker claims its client
 * before precaching has finished, so a check that stops there passes while the
 * cache is still empty and every offline request then fails for the wrong
 * reason. The honest signal is a populated precache.
 */
async function serviceWorkerReady(page) {
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (!registration?.active || !navigator.serviceWorker.controller) return false;
      const names = await caches.keys();
      const precache = names.find((n) => n.includes('precache'));
      if (!precache) return false;
      const entries = await (await caches.open(precache)).keys();
      return entries.length > 0;
    },
    null,
    { timeout: 30000 }
  );
}

test.describe('the service worker', () => {
  test('registers with the project subpath as its scope', async ({ page }) => {
    await freshVisit(page);
    await serviceWorkerReady(page);

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration.scope;
    });
    // A wrong base path silently breaks control of the page (§3.1).
    expect(scope).toContain('/explore-chords/');
  });

  test('the manifest is served and names maskable icons', async ({ page }) => {
    await freshVisit(page);
    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(href).toContain('/explore-chords/');

    const response = await page.request.get(href);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe('Explore Chords');
    expect(manifest.start_url).toBe('/explore-chords/');
    expect(manifest.scope).toBe('/explore-chords/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);

    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, new URL(href, page.url())).toString();
      const iconResponse = await page.request.get(iconUrl);
      expect(iconResponse.ok(), icon.src).toBe(true);
    }
  });
});

test.describe('offline', () => {
  test('works with the network off, including chords never searched before', async ({
    page,
    context,
  }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await serviceWorkerReady(page);

    await context.setOffline(true);
    await page.reload();

    // The shell came back from cache.
    await expect(page.locator('#chord-input')).toBeVisible();
    await expect(page.locator('.ec-chip-label')).toContainText('Guitar');

    // The real assertion: compute a chord this session has never seen. Caching
    // the shell would pass a weaker test while a hidden network dependency
    // lurked in the search.
    await searchChord(page, 'F#m7b5');
    await expect(page.locator('.ec-card').first()).toBeVisible();
    const state = await appState(page);
    expect(state.chordText).toBe('F#m7b5');
    expect(state.resultCount).toBeGreaterThan(0);

    // And switching instrument offline still re-derives everything.
    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'ukulele');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');

    await context.setOffline(false);
  });

  test('a bookmarked deep link still works offline', async ({ page, context }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await serviceWorkerReady(page);

    // A link carrying app state, which is how every URL in this app looks
    // (§8.1). Reloading it offline proves the query string does not stop the
    // cached shell being found.
    await page.goto('./?c=Am7&i=6guitar&t=E2,A2,D3,G3,B3,E4');
    await expect(page.locator('#chord-input')).toHaveValue('Am7');

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#chord-input')).toHaveValue('Am7');
    await expect(page.locator('.ec-card').first()).toBeVisible();
    expect((await appState(page)).resultCount).toBeGreaterThan(0);

    await context.setOffline(false);
  });
});

test.describe('updates', () => {
  test('a new version asks rather than reloading under the user', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await serviceWorkerReady(page);

    // Nothing is shown until there is genuinely something to update to.
    await expect(page.locator('.ec-toast')).toHaveCount(0);

    // Drive the real component rather than fabricating markup, so the
    // dismiss handler is genuinely under test. The contract is the app's
    // response to an available update: prompt, never reload underneath
    // someone who may be mid-lesson with a sheet open (§7).
    const before = page.url();
    await page.evaluate(() => window.__ec.updates.show());

    await expect(page.locator('.ec-toast')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Later' })).toBeVisible();
    // Still on the same page: nothing reloaded on its own.
    expect(page.url()).toBe(before);
    await expect(page.locator('#chord-input')).toBeVisible();

    await page.locator('#update-dismiss').click();
    await expect(page.locator('.ec-toast')).toHaveCount(0);
  });
});

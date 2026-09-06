import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * Suggesting installation (docs/DESIGN.md §7).
 *
 * Installing a PWA is buried in a browser menu on Android and is Share then
 * "Add to Home Screen" on iOS. Someone who would benefit has to be told it is
 * possible.
 *
 * `beforeinstallprompt` cannot be triggered for real in a test, so these
 * dispatch it and assert on what the app does with it.
 */

/** Pretend the browser offered an install prompt, and report if it was used. */
async function offerInstall(page) {
  await page.evaluate(() => {
    window.__installPrompted = false;
    const event = new Event('beforeinstallprompt');
    event.preventDefault = () => {};
    event.prompt = () => {
      window.__installPrompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
}

test.describe('the install suggestion', () => {
  test('waits until the user has seen the app work', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await offerInstall(page);

    // Nothing searched yet: asking now invites a permanent refusal.
    await expect(page.locator('.ec-install')).toHaveCount(0);

    await searchChord(page, 'C');
    await expect(page.locator('.ec-install')).toBeVisible();
    await expect(page.locator('.ec-install')).toContainText('home screen');
  });

  test('installs when accepted', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await offerInstall(page);
    await searchChord(page, 'C');

    await page.locator('#install-accept').click();
    await expect(page.locator('.ec-install')).toHaveCount(0);
    expect(await page.evaluate(() => window.__installPrompted)).toBe(true);
  });

  test('"not now" keeps quiet for the session but asks again later', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await offerInstall(page);
    await searchChord(page, 'C');

    await page.locator('#install-dismiss').click();
    await expect(page.locator('.ec-install')).toHaveCount(0);

    // Still quiet after another search in the same session.
    await searchChord(page, 'G');
    await expect(page.locator('.ec-install')).toHaveCount(0);

    // But a later visit may ask again, since nothing permanent was chosen.
    await page.reload();
    await offerInstall(page);
    await searchChord(page, 'Am');
    await expect(page.locator('.ec-install')).toBeVisible();
  });

  test('"don\'t ask again" is permanent', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await offerInstall(page);
    await searchChord(page, 'C');

    await page.locator('#install-never').check();
    await page.locator('#install-dismiss').click();
    await expect(page.locator('.ec-install')).toHaveCount(0);

    await page.reload();
    await offerInstall(page);
    await searchChord(page, 'Am');
    await expect(page.locator('.ec-install')).toHaveCount(0);
  });

  test('says nothing when the browser offers no install', async ({ page }) => {
    // No beforeinstallprompt, and not iOS: there is nothing to suggest.
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await expect(page.locator('.ec-install')).toHaveCount(0);
  });
});

test.describe('on iOS, where there is no install API', () => {
  // Safari never fires beforeinstallprompt and offers no way to install
  // programmatically, so the only honest thing is to show the steps.
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('shows the steps instead of a button that cannot work', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');

    const banner = page.locator('.ec-install');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Add to Home Screen');
    // No Install button: there is nothing it could do.
    await expect(page.locator('#install-accept')).toHaveCount(0);
    await expect(page.locator('#install-dismiss')).toHaveText('Got it');
  });

  test('can still be silenced for good', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('#install-never').check();
    await page.locator('#install-dismiss').click();

    await page.reload();
    await searchChord(page, 'Am');
    await expect(page.locator('.ec-install')).toHaveCount(0);
  });
});

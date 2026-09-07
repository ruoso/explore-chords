import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshVisit, completeSetup, dismissTutorial } from './helpers.js';

/**
 * The tutorial and "what changed" (docs/DESIGN.md §2.8).
 *
 * One mechanism: the tutorial is shown on a first open, a release note once on
 * the first open after it appears, and both stay reachable from Help.
 */

/** Rewrite which announcements this profile has seen, as the app stores it. */
async function setSeen(page, ids) {
  await page.evaluate((seen) => {
    const key = 'ec:v2:prefs';
    const prefs = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    prefs.seenAnnouncements = seen;
    window.localStorage.setItem(key, JSON.stringify(prefs));
  }, ids);
}

const dialog = (page) => page.locator('#announcement-dialog');

test.describe('the tutorial', () => {
  test('appears once, after first-run setup, not over the setup screen', async ({ page }) => {
    await freshVisit(page);
    // Setup is self-explanatory; a tutorial about screens you cannot see yet
    // would be noise.
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    await page.selectOption('#instrument-catalog', '6guitar');
    await page.getByRole('button', { name: 'Start playing' }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAttribute('data-announcement', 'welcome');
    await expect(dialog(page)).toContainText('Welcome to Explore Chords');
    await page.locator('#announcement-close').click();
    await expect(dialog(page)).toHaveCount(0);

    // Seen: it does not come back, and neither does the release note, since a
    // newcomer was not around for the versions it describes.
    await page.reload();
    await expect(page.locator('#chord-input')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('is available from Help, and opening it there marks nothing', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await setSeen(page, ['welcome']); // a returning user with a release pending

    await page.locator('#help-open').click();
    await expect(dialog(page)).toHaveAttribute('data-announcement', 'welcome');
    await page.locator('#announcement-close').click();

    // The pending release note is still pending.
    await page.reload();
    await expect(dialog(page)).toHaveAttribute('data-announcement', '0.2.0');
  });

  test('links to what changed, and back', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await page.locator('#help-open').click();

    await page.locator('#announcement-switch').click();
    await expect(dialog(page)).toHaveAttribute('data-announcement', '0.2.0');
    await expect(dialog(page)).toContainText('What changed');

    await page.locator('#announcement-switch').click();
    await expect(dialog(page)).toHaveAttribute('data-announcement', 'welcome');
  });

  test('closes on Escape, and that counts as seen', async ({ page }) => {
    await freshVisit(page);
    await page.selectOption('#instrument-catalog', '6guitar');
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(dialog(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#chord-input')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
  });
});

test.describe('what changed', () => {
  test('a returning user sees a new release note once', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    // As if they had last used the app before 0.2.0 existed.
    await setSeen(page, ['welcome']);

    await page.reload();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAttribute('data-announcement', '0.2.0');
    await page.locator('#announcement-close').click();

    await page.reload();
    await expect(page.locator('#chord-input')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('is not shown while setup is still to do', async ({ page }) => {
    await freshVisit(page);
    await setSeen(page, ['welcome']);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  test('the dialog passes an axe scan and traps focus on its controls', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await page.locator('#help-open').click();
    await expect(dialog(page)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await expect(page.locator('#announcement-close')).toBeFocused();
    await dismissTutorial(page);
  });
});

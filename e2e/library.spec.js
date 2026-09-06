import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord, goToView } from './helpers.js';

/**
 * Saved shapes (docs/DESIGN.md §2.6, §8.3).
 *
 * Its own screen rather than a drawer under the chord view. Favourites are
 * tagged by instrument, because a guitar shape means nothing on a ukulele.
 */
test.describe('saving shapes', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
  });

  test('starring a shape puts it in the library and survives a reload', async ({ page }) => {
    await goToView(page, 'library');
    await expect(page.locator('.ec-empty')).toContainText('Nothing saved');

    await goToView(page, 'explore');
    const star = page.locator('.ec-star').first();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await expect(page.locator('.ec-star').first()).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await goToView(page, 'library');
    await expect(page.locator('.ec-card')).toHaveCount(1);
    await expect(page.locator('.ec-card-chord').first()).toHaveText('C');
    // The diagram is rebuilt from the stored frets, not a saved snapshot.
    await expect(page.locator('svg.ec-diagram')).toHaveCount(1);
  });

  test('unstarring removes it again', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await page.locator('.ec-star').first().click();
    await goToView(page, 'library');
    await expect(page.locator('.ec-empty')).toBeVisible();
  });

  test('removing from the library clears the star on the card', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await goToView(page, 'library');
    await page.getByRole('button', { name: /Remove C/ }).click();
    await expect(page.locator('.ec-empty')).toBeVisible();

    await goToView(page, 'explore');
    await expect(page.locator('.ec-star').first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('opening a saved shape searches for its chord again', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await searchChord(page, 'G');
    await expect(page.locator('#chord-input')).toHaveValue('G');

    await goToView(page, 'library');
    await page.getByRole('button', { name: /Show C on the chords screen/ }).click();
    await expect(page.locator('#chord-input')).toHaveValue('C');
  });
});

test.describe('the library follows the instrument', () => {
  test('shapes saved for a guitar do not appear under a ukulele', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('.ec-star').first().click();

    await goToView(page, 'library');
    await expect(page.locator('.ec-card')).toHaveCount(1);

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'ukulele');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');

    // A guitar shape is meaningless here, so the ukulele's library is its own.
    await goToView(page, 'library');
    await expect(page.locator('.ec-empty')).toBeVisible();

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: /Guitar/ }).click();
    await goToView(page, 'library');
    await expect(page.locator('.ec-card')).toHaveCount(1);
  });
});

test.describe('custom tunings', () => {
  test('a custom tuning becomes its own instrument and can be named', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', '6guitar');
    await page.fill('#setup-custom', 'D2, A2, D3, G3, A3, D4');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Custom');

    // Naming it is the point: three custom tunings all called "Custom" would
    // be useless in the switcher.
    await goToView(page, 'instrument');
    await page.fill('#instrument-name', 'DADGAD');
    await page.locator('#instrument-save').click();
    await expect(page.locator('.ec-chip-label')).toContainText('DADGAD');

    await page.reload();
    await expect(page.locator('.ec-chip-label')).toContainText('DADGAD');
  });
});

import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * Saved shapes (docs/DESIGN.md §2.6, §8.3). Favourites are tagged by instrument
 * and filtered to the active one, because a guitar shape means nothing on a
 * ukulele.
 */
test.describe('saving shapes', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
  });

  test('starring a shape puts it in the library and survives a reload', async ({ page }) => {
    await expect(page.locator('.ec-library-count')).toHaveText('0');

    const star = page.locator('.ec-star').first();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await expect(page.locator('.ec-star').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ec-library-count')).toHaveText('1');

    await page.reload();
    await expect(page.locator('.ec-library-count')).toHaveText('1');

    await page.locator('#library-toggle').click();
    await expect(page.locator('.ec-library .ec-card')).toHaveCount(1);
    await expect(page.locator('.ec-card-chord').first()).toHaveText('C');
    // The diagram is rebuilt from the stored frets, not a saved snapshot.
    await expect(page.locator('.ec-library svg.ec-diagram')).toHaveCount(1);
  });

  test('unstarring removes it again', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await expect(page.locator('.ec-library-count')).toHaveText('1');
    await page.locator('.ec-star').first().click();
    await expect(page.locator('.ec-library-count')).toHaveText('0');
  });

  test('removing from the library clears the star on the card', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await page.locator('#library-toggle').click();
    await page.locator('.ec-library').getByRole('button', { name: /Remove/ }).click();

    await expect(page.locator('.ec-library-count')).toHaveText('0');
    await expect(page.locator('.ec-star').first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('opening a saved shape searches for its chord again', async ({ page }) => {
    await page.locator('.ec-star').first().click();
    await searchChord(page, 'G');
    await expect(page.locator('#chord-input')).toHaveValue('G');

    await page.locator('#library-toggle').click();
    await page.locator('.ec-library').getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('#chord-input')).toHaveValue('C');
  });
});

test.describe('the library follows the instrument', () => {
  test('shapes saved for a guitar do not appear under a ukulele', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('.ec-star').first().click();
    await expect(page.locator('.ec-library-count')).toHaveText('1');

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'ukulele');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');

    // A guitar shape is meaningless here, so the ukulele's library is its own.
    await expect(page.locator('.ec-library-count')).toHaveText('0');

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: /Guitar/ }).click();
    await expect(page.locator('.ec-library-count')).toHaveText('1');
  });
});

test.describe('custom tunings', () => {
  test('a custom tuning becomes its own instrument in the switcher', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', '6guitar');
    await page.fill('#setup-custom', 'D2, A2, D3, G3, A3, D4');
    await page.getByRole('button', { name: 'Add instrument' }).click();

    await expect(page.locator('.ec-chip-label')).toContainText('Custom');
    await page.locator('.ec-chip-summary').click();
    // Both the stock tuning and the custom one are listed as separate things
    // to play (§2.1).
    await expect(page.locator('.ec-chip-item')).toHaveCount(3); // two plus "Add"

    await page.reload();
    await expect(page.locator('.ec-chip-label')).toContainText('Custom');
  });
});

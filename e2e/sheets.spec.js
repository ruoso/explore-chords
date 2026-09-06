import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * Song sheets (docs/DESIGN.md §2.5, §8.2): an ordered, sectioned set of chords
 * each pinned to one chosen fingering, printable and shareable as a link.
 */
test.describe('building a sheet', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('#sheets-toggle').click();
    await page.locator('#sheet-new').click();
  });

  test('a fingering can be pinned into the sheet from the results', async ({ page }) => {
    await expect(page.locator('.ec-slot')).toHaveCount(0);

    await page.locator('.ec-tosheet').first().click();
    await expect(page.locator('.ec-slot')).toHaveCount(1);
    await expect(page.locator('.ec-slot-chord').first()).toHaveText('C');

    await searchChord(page, 'Am');
    await page.locator('.ec-tosheet').first().click();
    await expect(page.locator('.ec-slot')).toHaveCount(2);
    await expect(page.locator('.ec-slot-chord').nth(1)).toHaveText('Am');
  });

  test('sections can be added, renamed and reordered', async ({ page }) => {
    await page.fill('.ec-section-name', 'Verse');
    await page.locator('#sheet-add-section').click();
    await expect(page.locator('.ec-section')).toHaveCount(2);

    await page.locator('.ec-section-name').nth(1).fill('Chorus');
    await page.locator('.ec-section-name').nth(1).blur();

    let names = await page.locator('.ec-section-name').evaluateAll((n) => n.map((x) => x.value));
    expect(names).toEqual(['Verse', 'Chorus']);

    await page.getByRole('button', { name: 'Move Chorus up' }).click();
    names = await page.locator('.ec-section-name').evaluateAll((n) => n.map((x) => x.value));
    expect(names).toEqual(['Chorus', 'Verse']);
  });

  test('the legend counts each distinct chord and shape once', async ({ page }) => {
    await page.locator('.ec-tosheet').first().click();
    await expect(page.locator('#sheet-legend-count')).toContainText('1 distinct');

    // The same shape again is still one shape.
    await page.locator('.ec-tosheet').first().click();
    await expect(page.locator('.ec-slot')).toHaveCount(2);
    await expect(page.locator('#sheet-legend-count')).toContainText('1 distinct');

    // A different shape of the same chord is a second entry.
    await page.locator('.ec-tosheet').nth(1).click();
    await expect(page.locator('#sheet-legend-count')).toContainText('2 distinct');
  });

  test('a sheet survives a reload', async ({ page }) => {
    await page.fill('#sheet-title', 'Blackbird');
    await page.locator('#sheet-title').blur();
    await page.locator('.ec-tosheet').first().click();

    await page.reload();
    await page.locator('#sheets-toggle').click();
    await expect(page.locator('#sheet-title')).toHaveValue('Blackbird');
    await expect(page.locator('.ec-slot')).toHaveCount(1);
  });
});

test.describe('printing', () => {
  test('the print layout shows a legend and the progressions', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('#sheets-toggle').click();
    await page.locator('#sheet-new').click();
    await page.fill('#sheet-title', 'Lesson one');
    await page.locator('#sheet-title').blur();
    await page.locator('.ec-tosheet').first().click();
    await searchChord(page, 'G');
    await page.locator('.ec-tosheet').first().click();

    // Render the print view without opening the browser's print dialog.
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();

    const printRoot = page.locator('#print-root');
    await expect(printRoot.locator('.ec-print-title')).toHaveText('Lesson one');
    await expect(printRoot.locator('.ec-print-chord')).toHaveCount(2);
    await expect(printRoot.locator('svg.ec-diagram')).toHaveCount(2);
    await expect(printRoot.locator('.ec-print-progression').first()).toContainText('C');

    // Under print media the sheet is what shows, and the app is not.
    await page.emulateMedia({ media: 'print' });
    await expect(printRoot).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('sharing a sheet', () => {
  test('a share link round-trips and imports with the sheet intact', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('#sheets-toggle').click();
    await page.locator('#sheet-new').click();
    await page.fill('#sheet-title', 'Shared song');
    await page.locator('#sheet-title').blur();
    await page.locator('.ec-tosheet').first().click();

    await page.locator('#sheet-share').click();
    const link = await page.locator('.ec-share-link').inputValue();
    expect(link).toContain('#s=');

    // Open it as somebody else, on a different instrument.
    const context = await page.context().browser().newContext();
    const other = await context.newPage();
    await other.goto('./');
    await other.selectOption('#setup-instrument', 'ukulele');
    await other.getByRole('button', { name: 'Start playing' }).click();
    await other.goto(link);

    // The sheet carries its own instrument, so the viewing-as bar appears
    // rather than the sheet being silently retuned.
    await expect(other.locator('.ec-viewas')).toBeVisible();
    await expect(other.locator('.ec-viewas-text')).toContainText('Viewing as');

    await other.locator('#sheets-toggle').click();
    await expect(other.locator('#sheet-title')).toHaveValue('Shared song');
    await expect(other.locator('.ec-slot')).toHaveCount(1);
    await expect(other.locator('.ec-slot-chord').first()).toHaveText('C');
    await context.close();
  });
});

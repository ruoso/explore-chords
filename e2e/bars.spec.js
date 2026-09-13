import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, goToView } from './helpers.js';

/**
 * Bar numbers on the page (docs/DESIGN.md §2.12).
 *
 * For relating a chart back to the score it was transcribed from, which is why
 * they are off by default and why a collapsed repeat can carry the same numbers
 * twice.
 */
test.describe('bar numbers', () => {
  const SONG = [
    '# A',
    'Dm | G7 | C7 | F',
    'Bb | A7 | Dm | %',
    '',
    '# A second time @1',
    'Dm | G7 | C7 | F',
    'Cm | F7 | @15 Bb | %',
    '',
  ].join('\n');

  const openSong = async (page, body) => {
    await goToView(page, 'sheets');
    const back = page.locator('.ec-back');
    if (await back.count()) await back.click();
    await page.fill('#new-sheet-title', 'Numbered');
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', body);
    await page.locator('#sheet-body').blur();
    await page.locator('#sheet-view').click();
  };

  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('are off until asked for, then run in the margin', async ({ page }) => {
    await openSong(page, SONG);
    await expect(page.locator('#chart-bar-numbers')).not.toBeChecked();
    await expect(page.locator('.ec-print-barnum')).toHaveCount(0);

    await page.locator('#chart-bar-numbers').check();
    // One per chart line, and the second section starts over at 1 because the
    // repeat was written out straight.
    await expect(page.locator('.ec-print-barnum')).toHaveText(['1', '5', '1', '5']);
  });

  test('show a number stated mid-line at the bar that states it', async ({ page }) => {
    await openSong(page, SONG);
    await page.locator('#chart-bar-numbers').check();

    // A margin number alone would leave the jump invisible: the reader would
    // count 5, 6, 7, 8 where the truth is 5, 6, 15, 16.
    await expect(page.locator('.ec-bar-stated')).toHaveText(['15']);
    // And on the right bar: the cell carrying it is the one holding that Bb.
    // Asserted from the number outwards, since the song has an earlier Bb in
    // the section above with no number on it.
    const cell = await page.evaluate(
      () => document.querySelector('.ec-bar-stated').closest('.ec-print-cell').textContent
    );
    expect(cell).toBe('15Bb');
  });

  test('add no bar line of their own before the first bar', async ({ page }) => {
    await openSong(page, SONG);
    await page.locator('#chart-bar-numbers').check();

    // The margin is an annotation about the music, not a part of it, so the
    // first real bar still has nothing drawn before it.
    const border = await page.evaluate(() => {
      const first = document.querySelector('.ec-print-barnum + .ec-print-cell');
      return getComputedStyle(first).borderLeftWidth;
    });
    expect(border).toBe('0px');
  });

  test('reach the printed sheet, which is the same renderer', async ({ page }) => {
    await openSong(page, SONG);
    await page.locator('#chart-bar-numbers').check();
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();
    await expect(page.locator('#print-root .ec-print-barnum').first()).toHaveText('1');
  });

  test('are not offered for a song that reads words', async ({ page }) => {
    // A chord over a syllable says nothing about how many bars it lasts, so
    // there is no count the app can stand behind.
    await openSong(page, '# Verse\nG            D\nWhen I first saw you\n');
    await expect(page.locator('#chart-bar-numbers')).toHaveCount(0);
    await expect(page.locator('#chart-voiced-as')).toBeVisible();
  });
});

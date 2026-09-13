import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, goToView } from './helpers.js';

/**
 * Entering a shape by clicking it (docs/DESIGN.md §2.11).
 *
 * The picker offers what the search found, which is no answer at all when you
 * already know what you want to play and it is not on the list.
 */
test.describe('entering a shape by hand', () => {
  const hit = (page, string, fret) =>
    page.locator(`#shape-board .ec-hit[data-string="${string}"][data-fret="${fret}"]`);

  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'sheets');
    await page.fill('#new-sheet-title', 'Shapes');
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', '# A\nGm | C7');
    await page.locator('#sheet-body').blur();
  });

  /**
   * A chord has as many shapes as it has shapes — 43 of them for a C on a
   * guitar. With the buttons under that list, the way in was on screen and
   * unfindable.
   */
  test('offers the way in above the list, not past the end of it', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 727 });
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await expect(page.locator('#voicing-dialog')).toBeVisible();

    const placement = await page.evaluate(() => {
      const enter = document.querySelector('#voicing-enter').getBoundingClientRect();
      const first = document.querySelector('.ec-dialog-choice').getBoundingClientRect();
      return {
        choices: document.querySelectorAll('.ec-dialog-choice').length,
        onScreen: enter.top >= 0 && enter.bottom <= window.innerHeight,
        aboveTheList: enter.bottom <= first.top,
      };
    });
    // Enough shapes that the list is longer than the screen.
    expect(placement.choices).toBeGreaterThan(10);
    expect(placement.onScreen).toBe(true);
    expect(placement.aboveTheList).toBe(true);
  });

  test('builds a shape from nothing and writes it into the song', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-enter').click();
    await expect(page.locator('#shape-dialog')).toBeVisible();

    // A blank neck, and nothing to save yet.
    await expect(page.locator('#shape-readout')).toContainText('xxxxxx');
    await expect(page.locator('#shape-save')).toBeDisabled();

    // Every string has a click target per fret in the window, plus the row
    // above the nut that switches between open and not played.
    await expect(page.locator('#shape-board .ec-hit')).toHaveCount(6 * 7);

    for (const [string, fret] of [
      [2, 5],
      [3, 3],
      [4, 3],
      [5, 3],
    ]) {
      await hit(page, string, fret).click();
    }
    await expect(page.locator('#shape-readout')).toContainText('xx5333');

    await page.locator('#shape-save').click();
    await expect(page.locator('#sheet-body')).toHaveValue(/Gm = xx5333/);
  });

  test('opens on the shape in effect, so a near miss can be corrected', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-edit').click();

    // The default Gm, not an empty neck, and a window where that shape is.
    await expect(page.locator('#shape-readout')).toContainText('310033');
    await expect(page.locator('#shape-fret')).toHaveText('Frets 1 to 6');

    // A fret already held comes off when clicked again.
    await hit(page, 0, 3).click();
    await expect(page.locator('#shape-readout')).toContainText('x10033');
  });

  test('switches a string between open and not played above the nut', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-edit').click();

    await hit(page, 0, 'marker').click();
    await expect(page.locator('#shape-readout')).toContainText('010033');
    await hit(page, 0, 'marker').click();
    await expect(page.locator('#shape-readout')).toContainText('x10033');
  });

  test('says which note does not belong, in words and not only colour', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-edit').click();

    // F is not in a G minor triad.
    await hit(page, 0, 1).click();
    const foreign = page.locator('#shape-notes .is-foreign');
    await expect(foreign).toHaveCount(1);
    await expect(foreign).toHaveText('F2*');
    await expect(foreign).toHaveAttribute('aria-label', 'F2, not in the chord');
  });

  test('draws a shape no hand can hold rather than refusing to', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-enter').click();

    // Four notes on four frets, each on its own string: more of a stretch than
    // the app will assign fingers to. It still draws, and says so.
    for (const [string, fret] of [
      [0, 1],
      [1, 2],
      [2, 4],
      [3, 6],
    ]) {
      await hit(page, string, fret).click();
    }
    await expect(page.locator('#shape-board svg')).toBeVisible();
    await expect(page.locator('#shape-readout')).toContainText('No hand for this');
    // And it can still be saved: a shape can be right and awkward.
    await expect(page.locator('#shape-save')).toBeEnabled();
  });

  test('moves the window along the neck and stops at the nut', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Gm' }).first().click();
    await page.locator('#voicing-enter').click();

    await expect(page.locator('#shape-fret')).toHaveText('Frets 1 to 6');
    await page.locator('#shape-up').click();
    await page.locator('#shape-up').click();
    await expect(page.locator('#shape-fret')).toHaveText('Frets 3 to 8');
    for (let i = 0; i < 5; i += 1) await page.locator('#shape-down').click();
    await expect(page.locator('#shape-fret')).toHaveText('Frets 1 to 6');
  });

  test('is there for changing a shape everywhere it is used', async ({ page }) => {
    // The other way into the picker: the voicings panel, which re-voices the
    // chord across the whole song rather than in one bar.
    await page.locator('.ec-voicing-choice').first().click();
    await expect(page.locator('#voicing-enter')).toBeVisible();
    await page.locator('#voicing-enter').click();
    await hit(page, 3, 5).click();
    await page.locator('#shape-save').click();
    await expect(page.locator('#sheet-body')).toHaveValue(/xxx5xx/);
  });
});

import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, searchChord, goToView, addInstrument } from './helpers.js';

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

    await addInstrument(page, { instrument: 'ukulele' });
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

    // Naming it is the point: three custom tunings all called "Custom" would
    // be useless in the switcher. The add form can name it directly.
    await addInstrument(page, {
      instrument: '6guitar',
      strings: 'D2, A2, D3, G3, A3, D4',
      name: 'DADGAD',
    });
    await expect(page.locator('.ec-chip-label')).toContainText('DADGAD');

    await page.reload();
    await expect(page.locator('.ec-chip-label')).toContainText('DADGAD');
  });
});

/**
 * Same reasoning as the song's own list of shapes: the explorer's rows are
 * ranked and scroll sideways on a phone, a library is a set to find something
 * in and has the height of the page (§7).
 */
test.describe('the library on a narrow screen', () => {
  test('wraps its shapes down the page instead of off the side', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 727 });
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');

    const stars = page.locator('.ec-star');
    const many = Math.min(8, await stars.count());
    expect(many).toBeGreaterThan(2);
    for (let i = 0; i < many; i += 1) await stars.nth(i).click();

    await goToView(page, 'library');
    const shape = await page.evaluate(() => {
      const grid = document.querySelector('.ec-grid');
      const cards = [...grid.querySelectorAll('.ec-card')];
      return {
        cards: cards.length,
        scrollsSideways: grid.scrollWidth > grid.clientWidth + 1,
        rows: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      };
    });
    expect(shape.cards).toBe(many);
    expect(shape.scrollsSideways).toBe(false);
    expect(shape.rows).toBeGreaterThan(1);
  });
});

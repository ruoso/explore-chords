import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * The result view (docs/DESIGN.md §2.3): ranked by difficulty, grouped by
 * position, open first, with an honest empty state.
 */
test.describe('grouping and ranking', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('groups run open first, then up the neck', async ({ page }) => {
    await searchChord(page, 'C');
    const titles = await page.locator('.ec-group-title').allTextContents();
    expect(titles[0]).toContain('Open position');

    const frets = titles
      .slice(1)
      .map((t) => Number(/Fret (\d+)/.exec(t)?.[1]))
      .filter((n) => !Number.isNaN(n));
    expect(frets).toEqual([...frets].sort((a, b) => a - b));
  });

  test('show more expands a group and can be collapsed again', async ({ page }) => {
    await searchChord(page, 'C');
    // Whichever group overflows. Open position is deliberately small — it is
    // the handful of shapes at the nut, not everything with an open string —
    // so it is no longer guaranteed to be the one with a "Show all".
    const overflowing = page
      .locator('.ec-group', { has: page.getByRole('button', { name: /Show all/ }) })
      .first();
    await expect(overflowing).toBeVisible();
    // Pin it by its heading id. Once expanded its button reads "Show fewer",
    // so a locator filtered on "Show all" would silently drift to the next
    // group after the click and count that one instead.
    const id = await overflowing.getAttribute('aria-labelledby');
    const group = page.locator(`.ec-group[aria-labelledby="${id}"]`);
    const before = await group.locator('.ec-card').count();

    const button = group.getByRole('button', { name: /Show all/ });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();

    const after = await group.locator('.ec-card').count();
    expect(after).toBeGreaterThan(before);
    await expect(group.getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await group.getByRole('button', { name: 'Show fewer' }).click();
    expect(await group.locator('.ec-card').count()).toBe(before);
  });

  test('the easiest shape leads its group', async ({ page }) => {
    await searchChord(page, 'G');
    const first = page.locator('.ec-group').first().locator('.ec-badge').first();
    await expect(first).toHaveText('Easy');
  });
});

test.describe('display toggles', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
  });

  test('the neck view switches orientation without changing the results', async ({ page }) => {
    const before = await page.locator('.ec-card').count();
    await expect(page.locator('svg.ec-diagram-vertical').first()).toBeVisible();

    await page.getByRole('button', { name: 'Neck view' }).click();
    await expect(page.locator('svg.ec-diagram-horizontal').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Neck view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Orientation is a display concern: the same fingerings, drawn differently.
    expect(await page.locator('.ec-card').count()).toBe(before);
  });

  test('left-handed mirrors the diagram, and the choice persists', async ({ page }) => {
    const before = await page
      .locator('svg.ec-diagram')
      .first()
      .getAttribute('aria-label');

    await page.getByRole('button', { name: 'Left-handed' }).click();
    await expect(page.getByRole('button', { name: 'Left-handed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Mirroring changes the drawing, not what the chord is.
    const after = await page.locator('svg.ec-diagram').first().getAttribute('aria-label');
    expect(after).toBe(before);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Left-handed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

test.describe('the empty state is honest', () => {
  test('says nothing was found rather than showing an approximation', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await searchChord(page, 'C13#11');

    const empty = page.locator('.ec-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No fingerings');
    await expect(empty).toContainText('Ukulele');
    await expect(page.getByRole('button', { name: 'Adjust voicing rules' })).toBeVisible();
    // Nothing approximate is offered in place of the chord that was asked for.
    await expect(page.locator('.ec-card')).toHaveCount(0);
  });
});

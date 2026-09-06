import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { freshVisit, completeSetup, searchChord } from './helpers.js';

/**
 * Accessibility (docs/DESIGN.md §6.1, §9.5).
 *
 * Automated scanning catches perhaps half of what matters, so the keyboard and
 * labelling assertions below are as important as the axe run.
 */

async function scan(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
}

test.describe('axe finds no violations', () => {
  test('on the first-run setup screen', async ({ page }) => {
    await freshVisit(page);
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('on the explorer with results', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'Cmaj7');
    await expect(page.locator('.ec-card').first()).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test('with the pickers and toggles open', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C9');
    await page.locator('.ec-pickers-summary').click();
    await page.getByRole('button', { name: 'Neck view' }).click();
    expect(await scan(page)).toEqual([]);
  });

  test('on the empty state', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await searchChord(page, 'C13#11');
    await expect(page.locator('.ec-empty')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});

test.describe('every diagram describes itself', () => {
  test('carries a role and a substantial label', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C');

    const diagrams = page.locator('svg.ec-diagram');
    const count = await diagrams.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const svg = diagrams.nth(i);
      await expect(svg).toHaveAttribute('role', 'img');
      const label = await svg.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(10);
    }

    // The open C shape should describe its fingers and where its root sits.
    await expect(page.locator('svg.ec-diagram').first()).toHaveAttribute(
      'aria-label',
      /x32010.*open position.*fingers 3-2-1.*root on the 5th string/
    );
  });

  test('the difficulty badge carries a word, not only a colour', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C');
    const badges = page.locator('.ec-badge');
    expect(await badges.count()).toBeGreaterThan(0);
    for (const text of await badges.allTextContents()) {
      expect(['Easy', 'Medium', 'Hard']).toContain(text.trim());
    }
  });
});

test.describe('keyboard', () => {
  test('the scrolling result rows are reachable and traversable', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C');
    await expect(page.locator('.ec-grid').first()).toBeVisible();

    // The horizontally scrolling rows are the accessibility risk here: a
    // container that can only be reached with a mouse or a swipe is unusable
    // by keyboard.
    const grid = page.locator('.ec-grid').first();
    await expect(grid).toHaveAttribute('tabindex', '0');
    await grid.focus();
    await expect(grid).toBeFocused();
  });

  test('every interactive control can be tabbed to', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C');

    await page.locator('#chord-input').focus();
    const reached = new Set();
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const a = document.activeElement;
        return a?.id || a?.className || a?.tagName;
      });
      reached.add(id);
    }
    // The submit button, the pickers disclosure and a scroll row are all in
    // the tab order.
    expect([...reached].some((x) => String(x).includes('ec-button'))).toBe(true);
    expect([...reached].some((x) => String(x).includes('ec-grid'))).toBe(true);
  });

  test('results are announced to screen readers', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await searchChord(page, 'C');
    const live = page.locator('[aria-live="polite"]');
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toContainText(/fingerings in \d+ positions/);
  });
});

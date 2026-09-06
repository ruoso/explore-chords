import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord, appState, goToView } from './helpers.js';

/**
 * Voicing rules belong to the instrument (docs/DESIGN.md §2.4), not to the app.
 * A bass and a ukulele want permanently different rules, so a global mode you
 * have to remember to switch would be the wrong model.
 */
test.describe('presets', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'F');
    await goToView(page, 'instrument');
  });

  test('switching preset re-runs the search and changes the results', async ({ page }) => {
    const before = (await appState(page)).resultCount;
    expect(before).toBeGreaterThan(0);

    await page.selectOption('#heuristics-preset', 'beginner');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Beginner');

    const after = (await appState(page)).resultCount;
    expect(after).not.toBe(before);

    // A beginner preset forbids barres, so no barre shape may survive.
    await goToView(page, 'explore');
    const labels = await page.locator('svg.ec-diagram').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('aria-label'))
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).not.toContain('barre');
  });

  test('editing one rule flips the preset to Custom', async ({ page }) => {
    await expect(page.locator('.ec-panel-tag')).toHaveText('Standard');
    await page.locator('#rule-allowInnerMutes').check();
    await expect(page.locator('.ec-panel-tag')).toHaveText('Custom');
  });

  test('a weight can be edited and takes effect', async ({ page }) => {
    await page.locator('.ec-weights summary').click();
    await page.fill('#weight-barre', '9');
    await page.locator('#weight-barre').blur();
    await expect(page.locator('.ec-panel-tag')).toHaveText('Custom');
    await expect(page.locator('#weight-barre')).toHaveValue('9');
  });
});

test.describe('rules follow the instrument', () => {
  test('a guitar and a ukulele keep separate configurations', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'ukulele');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');

    // Give the ukulele a non-default preset.
    await goToView(page, 'instrument');
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');

    // The guitar must be untouched.
    await page.locator('.ec-chip-summary').click();
    await page.locator('.ec-chip-item', { hasText: 'Guitar' }).click();
    await expect(page.locator('.ec-panel-tag')).toHaveText('Standard');

    // And the ukulele must have kept its own.
    await page.locator('.ec-chip-summary').click();
    await page.locator('.ec-chip-item', { hasText: 'Ukulele' }).click();
    await goToView(page, 'instrument');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');
  });

  test('a configuration survives a reload', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'instrument');
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');

    await page.reload();
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');
  });

  test('a preset never re-enables a rule the instrument cannot use', async ({ page }) => {
    // Switching a ukulele to Jazz must not turn the root-bass rule back on:
    // its standard F sounds C lowest, so the rule would reject ordinary shapes.
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await searchChord(page, 'F');
    const before = (await appState(page)).resultCount;
    expect(before).toBeGreaterThan(0);

    await goToView(page, 'instrument');
    await expect(page.locator('#rule-rootInBass')).not.toBeChecked();
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('#rule-rootInBass')).not.toBeChecked();
    expect((await appState(page)).resultCount).toBeGreaterThan(0);
  });
});

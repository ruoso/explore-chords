import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, searchChord, appState, goToView, addInstrument, editActiveInstrument } from './helpers.js';

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
    await editActiveInstrument(page);
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

  test('fingerstyle is a preset of its own, not a rule to go hunting for', async ({ page }) => {
    // The rule that separates the two ways of playing, reachable by name.
    await page.selectOption('#heuristics-preset', 'fingerstyle');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Fingerstyle');
    await expect(page.locator('#rule-allowInnerMutes')).toBeChecked();

    await page.selectOption('#heuristics-preset', 'strumming');
    await expect(page.locator('#rule-allowInnerMutes')).not.toBeChecked();
  });

  test('editing one rule flips the preset to Custom', async ({ page }) => {
    await expect(page.locator('.ec-panel-tag')).toHaveText('Strumming');
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

    await addInstrument(page, { instrument: 'ukulele' });
    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');

    // Give the ukulele a non-default preset.
    await editActiveInstrument(page);
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');

    // The guitar must be untouched.
    await goToView(page, 'explore');
    await page.locator('.ec-chip-summary').click();
    await page.locator('.ec-chip-item', { hasText: 'Guitar' }).click();
    await editActiveInstrument(page);
    await expect(page.locator('.ec-panel-tag')).toHaveText('Strumming');

    // And the ukulele must have kept its own.
    await goToView(page, 'explore');
    await page.locator('.ec-chip-summary').click();
    await page.locator('.ec-chip-item', { hasText: 'Ukulele' }).click();
    await editActiveInstrument(page);
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');
  });

  test('a configuration survives a reload', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await editActiveInstrument(page);
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('.ec-panel-tag')).toHaveText('Jazz');

    // A reload returns to the instrument list rather than into a half-finished
    // edit, so the editor is reopened to check the saved rules.
    await page.reload();
    await editActiveInstrument(page);
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

    await editActiveInstrument(page);
    await expect(page.locator('#rule-rootInBass')).not.toBeChecked();
    await page.selectOption('#heuristics-preset', 'jazz');
    await expect(page.locator('#rule-rootInBass')).not.toBeChecked();
    expect((await appState(page)).resultCount).toBeGreaterThan(0);
  });
});

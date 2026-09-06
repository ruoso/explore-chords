import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, appState } from './helpers.js';

/**
 * First run is instrument setup (docs/DESIGN.md §2.1): the user lands in the
 * explorer already configured, rather than facing an instrument field in the
 * middle of a chord form.
 */
test.describe('first run', () => {
  test('a fresh profile lands on setup, not the explorer', async ({ page }) => {
    await freshVisit(page);
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toBeVisible();
    await expect(page.locator('#chord-input')).toHaveCount(0);
  });

  test('setup leads straight into the explorer', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page);
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toHaveCount(0);
    const state = await appState(page);
    expect(state.instrumentCount).toBe(1);
    expect(state.activeLabel).toContain('Guitar');
  });

  test('the chosen instrument survives a reload, with no second setup prompt', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    const before = await appState(page);

    await page.reload();
    await expect(page.locator('#chord-input')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose your instrument' })).toHaveCount(0);

    const after = await appState(page);
    expect(after.activeLabel).toBe(before.activeLabel);
    expect(after.activeLabel).toContain('Ukulele');
  });

  test('a custom tuning is accepted, and a broken one is refused', async ({ page }) => {
    await freshVisit(page);
    await page.fill('#instrument-tuning', 'not a tuning');
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#chord-input')).toHaveCount(0);

    await page.fill('#instrument-tuning', 'D2, A2, D3, G3, A3, D4');
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(page.locator('#chord-input')).toBeVisible();
    expect((await appState(page)).instrumentCount).toBe(1);
  });

  test('the name follows the pickers until you write your own', async ({ page }) => {
    await freshVisit(page);
    await expect(page.locator('#instrument-name')).toHaveValue('Guitar (6-string) · Standard');

    await page.selectOption('#instrument-catalog', 'ukulele');
    await expect(page.locator('#instrument-name')).toHaveValue(
      'Ukulele · Standard (re-entrant)'
    );

    // Once it is the user's, nothing overwrites it.
    await page.fill('#instrument-name', 'My uke');
    await page.selectOption('#instrument-catalog', 'cavaquinho');
    await expect(page.locator('#instrument-name')).toHaveValue('My uke');

    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(page.locator('.ec-chip-label')).toHaveText('My uke');
  });

  test('choosing a tuning preset fills the strings in', async ({ page }) => {
    await freshVisit(page);
    await expect(page.locator('#instrument-tuning')).toHaveValue('E2, A2, D3, G3, B3, E4');
    await page.selectOption('#instrument-tuning-preset', 'Drop D');
    await expect(page.locator('#instrument-tuning')).toHaveValue('D2, A2, D3, G3, B3, E4');

    // A tuning that matches a preset is recognised as that preset...
    await page.fill('#instrument-tuning', 'D2, A2, D3, G3, A3, D4');
    await expect(page.locator('#instrument-tuning-preset')).toHaveValue('DADGAD');

    // ...and one that matches none is custom.
    await page.fill('#instrument-tuning', 'C2, G2, C3, F3, A3, D4');
    await expect(page.locator('#instrument-tuning-preset')).toHaveValue('__custom__');
  });
});

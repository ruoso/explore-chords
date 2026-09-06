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
    await page.fill('#setup-custom', 'not a tuning');
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#chord-input')).toHaveCount(0);

    await page.fill('#setup-custom', 'D2, A2, D3, G3, A3, D4');
    await page.getByRole('button', { name: 'Start playing' }).click();
    await expect(page.locator('#chord-input')).toBeVisible();
    expect((await appState(page)).instrumentCount).toBe(1);
  });
});

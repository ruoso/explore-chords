import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, appState, searchChord } from './helpers.js';

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

  test('setup asks how you play, and the answer decides what you are shown', async ({ page }) => {
    // Whether a chord may have a muted string in the middle is a question about
    // the person, not the instrument, and nobody thinks to go looking for it
    // afterwards. So it is asked once, here, where it costs one glance.
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar', style: 'fingerstyle' });
    await searchChord(page, 'Gm');
    // A picking hand can leave the A string out, which strumming cannot.
    await expect(page.locator('.ec-results .ec-shorthand').first()).toHaveText('3x0333');
  });

  test('strumming is what you get if you do not choose', async ({ page }) => {
    await freshVisit(page);
    await expect(page.locator('#instrument-style')).toHaveValue('strumming');
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'Gm');
    await expect(page.locator('.ec-results .ec-shorthand').first()).not.toHaveText('3x0333');
  });

  test('a bass is offered its own rules from the start', async ({ page }) => {
    // Like the name, the style follows the instrument until the user picks.
    await freshVisit(page);
    await page.selectOption('#instrument-catalog', '4bass');
    await expect(page.locator('#instrument-style')).toHaveValue('bassFriendly');

    await page.selectOption('#instrument-style', 'fingerstyle');
    await page.selectOption('#instrument-catalog', '6guitar');
    await expect(page.locator('#instrument-style')).toHaveValue('fingerstyle');
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

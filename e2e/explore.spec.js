import { test, expect } from './fixtures.js';
import { freshVisit, completeSetup, appState, submitChord } from './helpers.js';

/**
 * Chord entry (docs/DESIGN.md §2.2): the typed field and the pickers are two
 * views of one chord and stay in sync, and ambiguous input is surfaced rather
 * than guessed at.
 */
test.describe('entering a chord', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('typing a chord produces grouped, ranked fingerings', async ({ page }) => {
    await page.fill('#chord-input', 'C');
    await submitChord(page);

    await expect(page.locator('.ec-group').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Open position/ })).toBeVisible();
    await expect(page.locator('.ec-card').first()).toBeVisible();
    // The open C shape should be present and near the front.
    await expect(page.locator('.ec-shorthand').first()).toHaveText('x32010');
    expect((await appState(page)).resultCount).toBeGreaterThan(0);
  });

  test('the pickers follow what was typed', async ({ page }) => {
    await page.fill('#chord-input', 'Am7');
    await submitChord(page);
    await page.locator('.ec-pickers-summary').click();

    await expect(page.locator('#picker-root')).toHaveValue('A');
    await expect(page.locator('#picker-quality')).toHaveValue('minor');
    await expect(page.locator('#picker-seventh')).toHaveValue('dominant');
  });

  test('changing a picker rewrites the text field', async ({ page }) => {
    await page.fill('#chord-input', 'C');
    await submitChord(page);
    await page.locator('.ec-pickers-summary').click();

    await page.selectOption('#picker-quality', 'minor');
    await expect(page.locator('#chord-input')).toHaveValue('Cm');

    await page.selectOption('#picker-seventh', 'major');
    await expect(page.locator('#chord-input')).toHaveValue(/7M/);
    expect((await appState(page)).resultCount).toBeGreaterThan(0);
  });

  test('invalid text leaves the last valid results on screen', async ({ page }) => {
    await page.fill('#chord-input', 'C');
    await submitChord(page);
    const before = await appState(page);
    expect(before.resultCount).toBeGreaterThan(0);

    await page.fill('#chord-input', 'not a chord');
    await submitChord(page);

    await expect(page.getByRole('alert')).toBeVisible();
    // The diagrams stay put: parse errors are non-blocking.
    await expect(page.locator('.ec-card').first()).toBeVisible();
    expect((await appState(page)).resultCount).toBe(before.resultCount);
  });
});

test.describe('the ambiguity chip', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('C9 shows which reading was taken and offers the other', async ({ page }) => {
    await page.fill('#chord-input', 'C9');
    await submitChord(page);

    const chip = page.locator('.ec-ambiguity');
    await expect(chip).toBeVisible();
    // Brazilian is the default dialect, so a bare 9 is an added 9th.
    await expect(chip).toContainText('added 9th');

    const flip = page.getByRole('button', { name: /Use dominant 9th/ });
    await expect(flip).toBeVisible();
    await flip.click();

    await expect(page.locator('.ec-ambiguity')).toContainText('dominant 9th');
  });

  test('C7+ is flagged too, since it means different chords', async ({ page }) => {
    await page.fill('#chord-input', 'C7+');
    await submitChord(page);
    await expect(page.locator('.ec-ambiguity')).toContainText('major 7th');
    await expect(page.getByRole('button', { name: /Use dominant 7th/ })).toBeVisible();
  });

  test('an unambiguous chord shows no chip', async ({ page }) => {
    await page.fill('#chord-input', 'Cmaj7');
    await submitChord(page);
    await expect(page.locator('.ec-ambiguity')).toHaveCount(0);
  });
});

test.describe('shareable URLs', () => {
  test('the address bar tracks the chord, and the link reproduces it', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await page.fill('#chord-input', 'Am7');
    await submitChord(page);

    await expect(page).toHaveURL(/c=Am7/);
    await expect(page).toHaveURL(/t=E2/);

    const url = page.url();
    const context = await page.context().browser().newContext();
    const fresh = await context.newPage();
    await fresh.goto(url);
    // A fresh profile with no instruments adopts the one the link carried.
    await expect(fresh.locator('#chord-input')).toHaveValue('Am7');
    await expect(fresh.locator('.ec-card').first()).toBeVisible();
    await context.close();
  });
});

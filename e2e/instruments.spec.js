import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, searchChord, appState } from './helpers.js';

/**
 * The instrument is the app's identity (docs/DESIGN.md §2.1): switching is
 * quick but deliberate, and a borrowed instrument never becomes the default by
 * accident.
 */
test.describe('switching instruments', () => {
  test('adding a second instrument and switching re-derives the results', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');

    const onGuitar = await appState(page);
    expect(onGuitar.resultCount).toBeGreaterThan(0);

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'ukulele');
    await page.getByRole('button', { name: 'Add instrument' }).click();

    await expect(page.locator('.ec-chip-label')).toContainText('Ukulele');
    const onUke = await appState(page);
    expect(onUke.instrumentCount).toBe(2);
    expect(onUke.effectiveLabel).toContain('Ukulele');
    // Same chord, different instrument, so the fingerings must differ.
    expect(onUke.resultCount).toBeGreaterThan(0);
    expect(onUke.resultCount).not.toBe(onGuitar.resultCount);

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: /Guitar/ }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Guitar');
    expect((await appState(page)).resultCount).toBe(onGuitar.resultCount);
  });

  test('the active instrument persists across a reload', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    await page.selectOption('#setup-instrument', 'cavaquinho');
    await page.getByRole('button', { name: 'Add instrument' }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Cavaquinho');

    await page.reload();
    await expect(page.locator('.ec-chip-label')).toContainText('Cavaquinho');
    expect((await appState(page)).instrumentCount).toBe(2);
  });
});

test.describe('viewing as, from a shared link', () => {
  const sharedLink = '?c=C&i=6guitar&t=E2,A2,D3,G3,B3,E4&l=Guitar%20%C2%B7%20Standard';

  test('a link for another instrument shows the bar without hijacking the default', async ({
    page,
  }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await page.goto(`./${sharedLink}`);

    await expect(page.locator('.ec-viewas')).toBeVisible();
    await expect(page.locator('.ec-viewas-text')).toContainText('Viewing as');

    const state = await appState(page);
    expect(state.viewAs).toContain('Guitar');
    expect(state.effectiveLabel).toContain('Guitar');
    // Borrowed, not adopted: the user's own instrument is untouched.
    expect(state.activeLabel).toContain('Ukulele');
    expect(state.instrumentCount).toBe(1);
  });

  test('the override does not survive a reload of the bare page', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await page.goto(`./${sharedLink}`);
    await expect(page.locator('.ec-viewas')).toBeVisible();

    await page.goto('./');
    await expect(page.locator('.ec-viewas')).toHaveCount(0);
    const state = await appState(page);
    expect(state.viewAs).toBeNull();
    expect(state.effectiveLabel).toContain('Ukulele');
  });

  test('"back to mine" restores the user instrument', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await page.goto(`./${sharedLink}`);
    await page.getByRole('button', { name: /Back to my/ }).click();

    await expect(page.locator('.ec-viewas')).toHaveCount(0);
    const state = await appState(page);
    expect(state.effectiveLabel).toContain('Ukulele');
    expect(state.instrumentCount).toBe(1);
  });

  test('"keep as my default" adopts it, and that one does persist', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: 'ukulele' });
    await page.goto(`./${sharedLink}`);
    await page.getByRole('button', { name: 'Keep as my default' }).click();

    await expect(page.locator('.ec-viewas')).toHaveCount(0);
    let state = await appState(page);
    expect(state.instrumentCount).toBe(2);
    expect(state.activeLabel).toContain('Guitar');

    await page.goto('./');
    state = await appState(page);
    expect(state.activeLabel).toContain('Guitar');
    expect(state.instrumentCount).toBe(2);
  });

  test('a link matching your own instrument raises no bar', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await page.goto(`./${sharedLink}`);
    await expect(page.locator('.ec-viewas')).toHaveCount(0);
    expect((await appState(page)).viewAs).toBeNull();
  });
});

import { test, expect } from './fixtures.js';
import {
  freshVisit,
  completeSetup,
  addInstrument,
  goToView,
  searchChord,
  appState,
} from './helpers.js';

/**
 * Instrument management (docs/DESIGN.md §2.1).
 *
 * Create and edit use the same form with the same fields. Editing acts on the
 * instrument whose row you clicked, not on whichever happens to be active.
 */
test.describe('the same form creates and edits', () => {
  test('every field offered when adding is offered when editing', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    const fields = ['#instrument-catalog', '#instrument-tuning-preset', '#instrument-tuning', '#instrument-name', '#instrument-frets'];

    await page.locator('.ec-chip-summary').click();
    await page.getByRole('button', { name: '+ Add instrument' }).click();
    for (const field of fields) await expect(page.locator(field)).toBeVisible();
    await page.locator('#instrument-cancel').click();

    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Edit/ }).first().click();
    for (const field of fields) await expect(page.locator(field)).toBeVisible();
  });

  test('an instrument can be renamed and retuned after the fact', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Edit/ }).first().click();
    await page.fill('#instrument-name', 'Nylon string');
    await page.selectOption('#instrument-tuning-preset', 'Drop D');
    await page.fill('#instrument-frets', '19');
    await page.locator('#instrument-save').click();

    await expect(page.locator('.ec-chip-label')).toHaveText('Nylon string');
    await expect(page.locator('.ec-instrument-tuning').first()).toContainText('D2, A2, D3');
    await expect(page.locator('.ec-instrument-tuning').first()).toContainText('19 frets');

    await page.reload();
    await expect(page.locator('.ec-chip-label')).toHaveText('Nylon string');
  });
});

test.describe('editing acts on the row you clicked', () => {
  test('not on whichever instrument is active', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });
    await expect(page.locator('.ec-chip-label')).toHaveText('Uke');

    // The ukulele is in use; edit the guitar.
    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Edit Guitar/ }).click();
    await expect(page.locator('#instrument-name')).toHaveValue(/Guitar/);
    await page.fill('#instrument-name', 'Steel string');
    await page.locator('#instrument-save').click();

    // The guitar was renamed; the ukulele is still the one in use.
    await expect(page.locator('.ec-chip-label')).toHaveText('Uke');
    const names = await page.locator('.ec-instrument-name').allTextContents();
    expect(names.some((n) => n.includes('Steel string'))).toBe(true);
    expect((await appState(page)).activeLabel).toBe('Uke');
  });

  test('use switches without leaving the screen', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });

    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Use Guitar/ }).click();
    await expect(page.locator('.ec-chip-label')).toContainText('Guitar');
    await expect(page.locator('.ec-instrument-row.is-active')).toContainText('Guitar');
  });
});

test.describe('deleting asks first', () => {
  test('and says what goes with it', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await searchChord(page, 'C');
    await page.locator('.ec-star').first().click();

    await goToView(page, 'sheets');
    await page.fill('#new-sheet-title', 'A song');
    await page.getByRole('button', { name: 'New song' }).click();

    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });
    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Delete Guitar/ }).click();

    const dialog = page.locator('#confirm-dialog');
    await expect(dialog).toBeVisible();
    // Saved shapes are tagged by instrument and go with it, so the prompt says
    // so rather than letting that be a surprise. Songs carry their own tuning
    // and survive, which it also says.
    await expect(dialog).toContainText('1 saved shape');
    await expect(dialog).toContainText('Songs are kept');

    await page.locator('#confirm-cancel').click();
    await expect(page.locator('.ec-instrument-row')).toHaveCount(2);

    await page.getByRole('button', { name: /^Delete Guitar/ }).click();
    await page.locator('#confirm-ok').click();
    await expect(page.locator('.ec-instrument-row')).toHaveCount(1);
    expect((await appState(page)).instrumentCount).toBe(1);
  });

  test('the last instrument cannot be deleted', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'instrument');
    await expect(page.locator('.ec-instrument-row')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  });
});

test.describe('leaving the screen abandons the form', () => {
  test('a half-finished edit does not reappear later', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });

    await goToView(page, 'instrument');
    await page.getByRole('button', { name: /^Edit/ }).first().click();
    await page.fill('#instrument-name', 'Half typed');

    await goToView(page, 'explore');
    await goToView(page, 'instrument');

    // Back to the list, and the unsaved name was not kept.
    await expect(page.locator('.ec-instrument-row')).toHaveCount(1);
    await expect(page.locator('#instrument-name')).toHaveCount(0);
    await expect(page.locator('.ec-chip-label')).not.toHaveText('Half typed');
  });
});

import { writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';
import {
  freshVisit,
  completeSetup,
  searchChord,
  appState,
  addInstrument,
  goToView,
  dismissTutorial,
} from './helpers.js';

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

    await addInstrument(page, { instrument: 'ukulele' });

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
    await addInstrument(page, { instrument: 'cavaquinho' });
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

/**
 * Everything lives in this browser, so it has to be possible to take it out
 * (docs/DESIGN.md §8.4).
 */
test.describe('backing everything up', () => {
  const songOf = async (page, title, body) => {
    await goToView(page, 'sheets');
    const back = page.locator('.ec-back');
    if (await back.count()) await back.click();
    await page.fill('#new-sheet-title', title);
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', body);
    await page.locator('#sheet-body').blur();
  };

  test('saves a zip and restores everything from it', async ({ page }, testInfo) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });
    await songOf(page, 'Valsa', 'Gm | D7 | Gm');
    await songOf(page, 'Coração / partido?', 'C | G | Am');

    // A starred shape, so the backup has one to carry.
    await goToView(page, 'explore');
    await searchChord(page, 'C');
    await page.locator('.ec-star').first().click();

    await goToView(page, 'instrument');
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#backup-save').click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toMatch(/^explore-chords-\d{4}-\d{2}-\d{2}\.zip$/);
    const file = testInfo.outputPath('backup.zip');
    await download.saveAs(file);

    // Wipe the device and come back to a first run. Storage is cleared by hand
    // because a test gets one browser context: this is the second visit within
    // it, standing in for a different machine.
    await page.evaluate(() => window.localStorage.clear());
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    expect((await appState(page)).sheetCount).toBe(0);

    await goToView(page, 'instrument');
    await page.locator('#backup-restore').click();
    await page.locator('#backup-file').setInputFiles(file);
    await expect(page.locator('.ec-dialog-confirm')).toBeVisible();
    await expect(page.locator('.ec-dialog-confirm')).toContainText('2 instruments');
    await expect(page.locator('.ec-dialog-confirm')).toContainText('2 songs');
    await page.getByRole('button', { name: 'Replace everything' }).click();

    // The page comes back up through the ordinary load path, on a bare address:
    // what was in the query string described the instrument this device had a
    // moment ago, which the backup has just replaced.
    await expect(page.locator('#chord-input')).toBeVisible();
    await dismissTutorial(page);
    const state = await appState(page);
    expect(state.instrumentCount).toBe(2);
    expect(state.sheetCount).toBe(2);

    await goToView(page, 'sheets');
    // Both songs are back, titles and all — including one whose title had to be
    // tidied to become a filename. The order of the list is not what this is
    // about, so it is compared without it.
    const titles = await page.locator('.ec-sheet-name').allTextContents();
    expect([...titles].sort()).toEqual(['Coração / partido?', 'Valsa']);
    await page.getByRole('button', { name: 'Edit Valsa' }).click();
    await expect(page.locator('#sheet-body')).toHaveValue('Gm | D7 | Gm');

    // The starred shape came back too, and belongs to the instrument it was
    // starred on — which is also the one the restored device is using.
    await goToView(page, 'library');
    await expect(page.locator('.ec-card')).toHaveCount(1);
    await expect(page.locator('.ec-viewas')).toHaveCount(0);
  });

  test('says so when the file is not a backup', async ({ page }, testInfo) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'instrument');

    const notAZip = testInfo.outputPath('holiday.zip');
    await writeFile(notAZip, 'this is not a zip at all');
    await page.locator('#backup-file').setInputFiles(notAZip);

    await expect(page.locator('#backup-error')).toBeVisible();
    await expect(page.locator('.ec-dialog-confirm')).toHaveCount(0);
  });
});

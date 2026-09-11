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
 * Everything lives in this browser, so it has to be possible to take it out
 * (docs/DESIGN.md §8.4): one zip, on a screen of its own, that restores here or
 * on another device.
 */
test.describe('backing everything up', () => {
  test('has a screen of its own in the navigation', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await expect(page.locator('#nav-backup')).toBeVisible();

    await page.locator('#nav-backup').click();
    await expect(page.getByRole('heading', { name: 'Backup', level: 2 })).toBeVisible();
    await expect(page.locator('#backup-save')).toBeVisible();
    await expect(page.locator('#backup-restore')).toBeVisible();
    // It lives in the address like every other screen, so it survives a reload.
    expect(page.url()).toContain('v=backup');
    await page.reload();
    await expect(page.locator('#backup-save')).toBeVisible();

    // And it is no longer tacked onto the instrument screen.
    await goToView(page, 'instrument');
    await expect(page.locator('#backup-save')).toHaveCount(0);
  });

  const songOf = async (page, title, body) => {
    await goToView(page, 'sheets');
    const back = page.locator('.ec-back');
    if (await back.count()) await back.click();
    await page.fill('#new-sheet-title', title);
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', body);
    await page.locator('#sheet-body').blur();
  };

  test('says when songs are in no backup, and stops once they are', async ({ page }, testInfo) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await goToView(page, 'sheets');
    await page.fill('#new-sheet-title', 'Valsa');
    await page.getByRole('button', { name: 'New song' }).click();
    await page.fill('#sheet-body', 'Gm | D7');
    await page.locator('#sheet-body').blur();
    await page.locator('#sheet-back').click();

    // Nothing is said about work done a minute ago.
    await expect(page.locator('#backup-nudge')).toHaveCount(0);

    // Wind the clock back, as if all of this had happened that long ago: the
    // songs, and any time the reminder was put away.
    const age = (days) =>
      page.evaluate((old) => {
        const sheets = JSON.parse(window.localStorage.getItem('ec:v2:sheets'));
        window.localStorage.setItem(
          'ec:v2:sheets',
          JSON.stringify(sheets.map((s) => ({ ...s, updated: Date.now() - old })))
        );
        const prefs = JSON.parse(window.localStorage.getItem('ec:v2:prefs') ?? '{}');
        if (prefs.backupNudgedAt) prefs.backupNudgedAt = Date.now() - old;
        window.localStorage.setItem('ec:v2:prefs', JSON.stringify(prefs));
      }, days * 24 * 60 * 60 * 1000);
    await age(14);
    await page.reload();
    await goToView(page, 'sheets');

    await expect(page.locator('#backup-nudge')).toBeVisible();
    // Counted, and phrased for the count it found.
    await expect(page.locator('#backup-nudge')).toContainText('The song here is in no backup');

    // Dismissing puts it away, and it is not shown again straight away — but it
    // comes back, because what it is warning about has not gone away.
    await page.locator('#nudge-dismiss').click();
    await expect(page.locator('#backup-nudge')).toHaveCount(0);
    await page.reload();
    await goToView(page, 'sheets');
    await expect(page.locator('#backup-nudge')).toHaveCount(0);

    // Saving a backup from the nudge answers it for good, not for a week.
    await age(14);
    await page.reload();
    await goToView(page, 'sheets');
    await expect(page.locator('#backup-nudge')).toBeVisible();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#nudge-save').click(),
    ]).then(([d]) => d);
    await download.saveAs(testInfo.outputPath('from-nudge.zip'));
    await expect(page.locator('#backup-nudge')).toHaveCount(0);
    await page.reload();
    await goToView(page, 'sheets');
    await expect(page.locator('#backup-nudge')).toHaveCount(0);
  });

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

    await goToView(page, 'backup');
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

    await goToView(page, 'backup');
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
    await goToView(page, 'backup');

    const notAZip = testInfo.outputPath('holiday.zip');
    await writeFile(notAZip, 'this is not a zip at all');
    await page.locator('#backup-file').setInputFiles(notAZip);

    await expect(page.locator('#backup-error')).toBeVisible();
    await expect(page.locator('.ec-dialog-confirm')).toHaveCount(0);
  });
});

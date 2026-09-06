import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, goToView, appState } from './helpers.js';

/**
 * Song sheets (docs/DESIGN.md §2.5, §8.2).
 *
 * A song is one block of text: a `#` line names a section, a vertical bar
 * separates measures, spaces separate chords in a measure. Voicings are chosen
 * per occurrence and written back into that text as footnotes, so nothing is
 * hidden from the person typing.
 */

async function newSong(page, title) {
  await goToView(page, 'sheets');
  await page.fill('#new-sheet-title', title);
  await page.getByRole('button', { name: 'New song' }).click();
  await expect(page.locator('#sheet-body')).toBeVisible();
}

async function setBody(page, text) {
  await page.fill('#sheet-body', text);
  await page.locator('#sheet-body').blur();
}

test.describe('the song list', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('creates, duplicates and deletes songs', async ({ page }) => {
    await goToView(page, 'sheets');
    await expect(page.locator('.ec-empty')).toContainText('No songs yet');

    await page.fill('#new-sheet-title', 'Blackbird');
    await page.getByRole('button', { name: 'New song' }).click();
    await expect(page.locator('#sheet-title')).toHaveValue('Blackbird');

    await page.locator('#sheet-back').click();
    await expect(page.locator('.ec-sheet-row')).toHaveCount(1);

    await page.getByRole('button', { name: 'Duplicate Blackbird' }).click();
    await expect(page.locator('.ec-sheet-row')).toHaveCount(2);
    await expect(page.locator('.ec-sheet-name').nth(1)).toHaveText('Blackbird (copy)');

    await page.getByRole('button', { name: 'Delete Blackbird (copy)' }).click();
    await expect(page.locator('.ec-sheet-row')).toHaveCount(1);
  });

  test('a song survives a reload', async ({ page }) => {
    await newSong(page, 'Blackbird');
    await setBody(page, '# Verse\nG | Am7 | C');
    await page.reload();
    await expect(page.locator('#sheet-title')).toHaveValue('Blackbird');
    await expect(page.locator('#sheet-body')).toHaveValue('# Verse\nG | Am7 | C');
  });
});

test.describe('writing the chart as text', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Lesson one');
  });

  test('bars make measures and headings make sections', async ({ page }) => {
    await setBody(page, '# Verse\nC  Am | F  G\nC | G\n\n# Chorus\nF | C');

    await expect(page.locator('.ec-song-section-name')).toHaveCount(2);
    await expect(page.locator('.ec-song-section-name').first()).toHaveText('Verse');
    await expect(page.locator('.ec-song-section-name').nth(1)).toHaveText('Chorus');
    // Two lines in the verse, one in the chorus.
    await expect(page.locator('.ec-song-line')).toHaveCount(3);
    // First line: two measures, the first holding two chords.
    const firstLine = page.locator('.ec-song-line').first();
    await expect(firstLine.locator('.ec-measure')).toHaveCount(2);
    await expect(firstLine.locator('.ec-measure').first().locator('.ec-measure-chord')).toHaveCount(2);
  });

  test('a symbol that is not a chord is reported, not silently dropped', async ({ page }) => {
    await setBody(page, 'C | wobble | G');
    await expect(page.getByRole('alert')).toContainText('Not a chord: wobble');
    await expect(page.locator('.ec-measure-chord.is-invalid')).toHaveCount(1);
  });
});

test.describe('choosing voicings', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Voicings');
    await setBody(page, 'A | Cm | A | Cm');
  });

  test('the first choice is written with no footnote', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await expect(page.locator('#voicing-dialog')).toBeVisible();
    await page.locator('.ec-dialog-choice').first().click();

    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toContain('# Voicings');
    expect(body).toMatch(/^Cm = \S+$/m);
    expect(body).not.toContain('Cm[2]');
    // The chart line itself is untouched.
    expect(body.split('\n')[0]).toBe('A | Cm | A | Cm');
  });

  test('a second, different voicing gets a footnote', async ({ page }) => {
    const cms = page.locator('.ec-measure-chord', { hasText: 'Cm' });
    await cms.first().click();
    await page.locator('.ec-dialog-choice').first().click();

    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).nth(1).click();
    // A different shape from the first.
    await page.locator('.ec-dialog-choice').nth(2).click();

    const body = await page.locator('#sheet-body').inputValue();
    expect(body.split('\n')[0]).toBe('A | Cm | A | Cm[2]');
    expect(body).toMatch(/^Cm = \S+$/m);
    expect(body).toMatch(/^Cm\[2\] = \S+$/m);

    // Both appear in the voicings panel, labelled the way the chart refers.
    await expect(page.locator('.ec-voicings .ec-card-chord')).toHaveCount(2);
    await expect(page.locator('.ec-voicings .ec-card-chord').nth(1)).toHaveText('Cm[2]');
    await expect(page.locator('.ec-footnote')).toHaveCount(1);
  });

  test('picking the same shape again reuses it rather than duplicating', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();

    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).nth(1).click();
    // The same choice as before.
    await page.locator('.ec-dialog-choice').first().click();

    const body = await page.locator('#sheet-body').inputValue();
    expect(body.split('\n')[0]).toBe('A | Cm | A | Cm');
    expect(body).not.toContain('Cm[2]');
    await expect(page.locator('.ec-voicings .ec-card-chord')).toHaveCount(1);
  });

  test('clearing a choice removes it from the text', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();
    expect(await page.locator('#sheet-body').inputValue()).toContain('# Voicings');

    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('#voicing-clear').click();

    const body = await page.locator('#sheet-body').inputValue();
    expect(body).not.toContain('# Voicings');
    expect(body.trim()).toBe('A | Cm | A | Cm');
  });

  test('voicings typed by hand are read back', async ({ page }) => {
    // The text is the whole state, so writing it directly must work.
    await setBody(page, 'A | Cm | A | Cm[2]\n\n# Voicings\nCm = x35543\nCm[2] = 8-10-10-8-8-8');
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(2);
    await expect(page.locator('.ec-footnote')).toHaveText('2');
    await expect(page.locator('.ec-voicings .ec-shorthand').first()).toHaveText('x35543');
  });

  test('the dialog can be dismissed without choosing', async ({ page }) => {
    const before = await page.locator('#sheet-body').inputValue();
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await expect(page.locator('#voicing-dialog')).toBeVisible();
    await page.locator('#voicing-cancel').click();
    await expect(page.locator('#voicing-dialog')).toHaveCount(0);
    expect(await page.locator('#sheet-body').inputValue()).toBe(before);
  });
});

test.describe('printing', () => {
  test('the print layout shows the legend and the chart', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Lesson one');
    await setBody(page, '# Verse\nC | G');

    for (const symbol of ['C', 'G']) {
      await page.locator('.ec-measure-chord', { hasText: symbol }).first().click();
      await page.locator('.ec-dialog-choice').first().click();
    }

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();

    const printRoot = page.locator('#print-root');
    await expect(printRoot.locator('.ec-print-title')).toHaveText('Lesson one');
    await expect(printRoot.locator('.ec-print-chord')).toHaveCount(2);
    await expect(printRoot.locator('svg.ec-diagram')).toHaveCount(2);
    await expect(printRoot.locator('.ec-print-section-name')).toHaveText('Verse');
    await expect(printRoot.locator('.ec-print-line')).toContainText('C  |  G');

    // Under print media the song is what shows, and the app is not.
    await page.emulateMedia({ media: 'print' });
    await expect(printRoot).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('sharing a song', () => {
  test('a link round-trips the song, voicings included', async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Shared song');
    await setBody(page, 'A | Cm | A | Cm[2]\n\n# Voicings\nCm = x35543\nCm[2] = 8-10-10-8-8-8');

    await page.locator('#sheet-share').click();
    const link = await page.locator('.ec-share-link').inputValue();
    expect(link).toContain('#s=');

    // Open it as somebody else, on a different instrument.
    const context = await page.context().browser().newContext();
    const other = await context.newPage();
    await other.goto('./');
    await other.selectOption('#setup-instrument', 'ukulele');
    await other.getByRole('button', { name: 'Start playing' }).click();
    await other.goto(link);

    // The song carries its own instrument, so the viewing-as bar appears rather
    // than the song being silently retuned.
    await expect(other.locator('.ec-viewas')).toBeVisible();

    const state = await appState(other);
    expect(state.view).toBe('sheets');
    expect(state.sheetCount).toBe(1);
    // The voicings travelled because they are part of the text.
    expect(state.body).toContain('Cm[2] = 8-10-10-8-8-8');
    await expect(other.locator('#sheet-title')).toHaveValue('Shared song');
    await context.close();
  });
});

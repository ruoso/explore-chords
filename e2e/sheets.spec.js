import { test, expect } from '@playwright/test';
import { freshVisit, completeSetup, goToView, appState, addInstrument } from './helpers.js';

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
    await expect(page.locator('.ec-empty')).toContainText('No songs for');

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

  test('the voicings panel and the block are both alphabetical', async ({ page }) => {
    await setBody(page, 'G | Am | C | D');
    for (const symbol of ['G', 'Am', 'C', 'D']) {
      await page.locator('.ec-measure-chord', { hasText: new RegExp(`^${symbol}$`) }).first().click();
      await page.locator('.ec-dialog-choice').first().click();
    }

    // The block reads alphabetically, not in the order the chords appear.
    const body = await page.locator('#sheet-body').inputValue();
    const block = body
      .slice(body.indexOf('# Voicings'))
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.split(' =')[0]);
    expect(block).toEqual(['Am', 'C', 'D', 'G']);

    // And so does the panel.
    await expect(page.locator('.ec-voicings .ec-card-chord')).toHaveText(['Am', 'C', 'D', 'G']);
  });

  test('voicings typed by hand are read back', async ({ page }) => {
    // The text is the whole state, so writing it directly must work.
    await setBody(page, 'A | Cm | A | Cm[2]\n\n# Voicings\nCm = x35543\nCm[2] = 8-10-10-8-8-8');
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(2);
    await expect(page.locator('.ec-footnote')).toHaveText('2');
    await expect(page.locator('.ec-voicings .ec-shorthand').first()).toHaveText('x35543');
  });

  test('a hand-written block in any order still displays sorted', async ({ page }) => {
    await setBody(page, 'G | Am | C\n\n# Voicings\nG = 320003\nC = x32010\nAm = x02210');

    // The panel is ordered for reading...
    await expect(page.locator('.ec-voicings .ec-card-chord')).toHaveText(['Am', 'C', 'G']);
    // ...while the text is left exactly as it was written. Reordering someone's
    // text merely because they opened the song would be rude.
    expect(await page.locator('#sheet-body').inputValue()).toContain(
      'G = 320003\nC = x32010\nAm = x02210'
    );
  });

  test('the picker groups and orders shapes exactly as the explorer does', async ({ page }) => {
    // A shape someone has already found on the chords screen should be in the
    // same place here: same groups, same order, same headings.
    await goToView(page, 'explore');
    await page.fill('#chord-input', 'Cm');
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.locator('.ec-card').first()).toBeVisible();

    const explorerGroups = await page.locator('.ec-group-title').allTextContents();
    const explorerShapes = await page.locator('.ec-results .ec-shorthand').allTextContents();
    expect(explorerGroups.length).toBeGreaterThan(1);

    await goToView(page, 'sheets');
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await expect(page.locator('#voicing-dialog')).toBeVisible();

    const dialogGroups = await page
      .locator('#voicing-dialog .ec-group-title')
      .allTextContents();
    const dialogShapes = await page
      .locator('#voicing-dialog .ec-dialog-choice .ec-shorthand')
      .allTextContents();

    expect(dialogGroups).toEqual(explorerGroups);
    expect(dialogShapes).toEqual(explorerShapes);
  });

  test('a group in the picker expands the same way', async ({ page }) => {
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    const dialog = page.locator('#voicing-dialog');
    const first = dialog.locator('.ec-group').first();
    const before = await first.locator('.ec-dialog-choice').count();

    const more = first.getByRole('button', { name: /Show all/ });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    expect(await first.locator('.ec-dialog-choice').count()).toBeGreaterThan(before);

    await first.getByRole('button', { name: 'Show fewer' }).click();
    expect(await first.locator('.ec-dialog-choice').count()).toBe(before);
  });

  test('clicking a voicing changes every place it is used', async ({ page }) => {
    await setBody(page, 'Cm | A | Cm | Cm');
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();

    // One entry, used three times.
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(1);
    await expect(page.locator('.ec-used-in')).toHaveText('3\u00d7');
    const before = await page.locator('#sheet-body').inputValue();
    const firstShape = /^Cm = (\S+)$/m.exec(before)[1];

    // Change the shape itself.
    await page.locator('.ec-voicing-choice').click();
    await expect(page.locator('#voicing-dialog')).toContainText('Change Cm everywhere');
    await expect(page.locator('#voicing-dialog')).toContainText('in 3 places');
    await page.locator('.ec-dialog-choice').nth(2).click();

    const after = await page.locator('#sheet-body').inputValue();
    const newShape = /^Cm = (\S+)$/m.exec(after)[1];
    expect(newShape).not.toBe(firstShape);

    // All three moved together, and no footnote was introduced.
    expect(after.split('\n')[0]).toBe('Cm | A | Cm | Cm');
    expect(after).not.toContain('Cm[2]');
    await expect(page.locator('.ec-used-in')).toHaveText('3\u00d7');
  });

  test('changing one voicing everywhere leaves the other alone', async ({ page }) => {
    await setBody(page, 'Cm | Cm | Cm');
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).nth(2).click();
    await page.locator('.ec-dialog-choice').nth(2).click();

    expect((await page.locator('#sheet-body').inputValue()).split('\n')[0]).toBe('Cm | Cm | Cm[2]');
    await expect(page.locator('.ec-voicings .ec-card-chord')).toHaveText(['Cm', 'Cm[2]']);
    await expect(page.locator('.ec-used-in')).toHaveText(['2\u00d7', '1\u00d7']);

    const footnoted = /^Cm\[2\] = (\S+)$/m.exec(await page.locator('#sheet-body').inputValue())[1];

    // Re-voice the default; the footnoted one must not move.
    await page.locator('.ec-voicing-choice').first().click();
    await page.locator('.ec-dialog-choice').nth(3).click();

    const after = await page.locator('#sheet-body').inputValue();
    expect(after.split('\n')[0]).toBe('Cm | Cm | Cm[2]');
    expect(/^Cm\[2\] = (\S+)$/m.exec(after)[1]).toBe(footnoted);
  });

  test('clearing a voicing everywhere empties all its places', async ({ page }) => {
    await setBody(page, 'Cm | A | Cm');
    await page.locator('.ec-measure-chord', { hasText: 'Cm' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(1);

    await page.locator('.ec-voicing-choice').click();
    await page.getByRole('button', { name: 'Clear everywhere' }).click();

    const after = await page.locator('#sheet-body').inputValue();
    expect(after).not.toContain('# Voicings');
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(0);
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
    await other.selectOption('#instrument-catalog', 'ukulele');
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

test.describe('songs and instruments', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('a song records the tuning it was written for', async ({ page }) => {
    await newSong(page, 'Guitar song');
    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toContain('# Tuning');
    expect(body).toContain('E2, A2, D3, G3, B3, E4');
  });

  test('switching instrument moves the song aside instead of breaking', async ({ page }) => {
    await newSong(page, 'Guitar song');
    await setBody(page, '# Tuning\nE2, A2, D3, G3, B3, E4\n\n# Verse\nC | G');
    await page.locator('.ec-measure-chord', { hasText: 'C' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(1);

    await addInstrument(page, { instrument: 'ukulele' });
    await goToView(page, 'sheets');

    // The guitar song is not shown as playable here — its voicings are shapes
    // for six strings — but it is not lost either.
    await expect(page.locator('.ec-empty')).toContainText('No songs for');
    const others = page.locator('.ec-sheet-row.is-other');
    await expect(others).toHaveCount(1);
    await expect(others).toContainText('Guitar song');
    await expect(others).toContainText('E2, A2, D3, G3, B3, E4');
  });

  test('bringing a song across keeps the chart and clears the voicings', async ({ page }) => {
    await newSong(page, 'Guitar song');
    await setBody(page, '# Tuning\nE2, A2, D3, G3, B3, E4\n\n# Verse\nC | G | C');
    for (const symbol of ['C', 'G']) {
      await page.locator('.ec-measure-chord', { hasText: new RegExp(`^${symbol}$`) }).first().click();
      await page.locator('.ec-dialog-choice').first().click();
    }

    await addInstrument(page, { instrument: 'ukulele' });
    await goToView(page, 'sheets');
    await page.getByRole('button', { name: /Bring Guitar song to/ }).click();

    // It opens straight into the copy, since the next thing to do is choose
    // voicings for it. Same chart, ukulele tuning, nothing voiced yet.
    await expect(page.locator('#sheet-body')).toBeVisible();
    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toContain('G4, C4, E4, A4');
    expect(body).toContain('C | G | C');
    expect(body).not.toContain('# Voicings');
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(0);

    // And voicing it now works, on this instrument's strings.
    await page.locator('.ec-measure-chord', { hasText: 'C' }).first().click();
    await page.locator('.ec-dialog-choice').first().click();
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(1);

    // The guitar original survives.
    await page.locator('#sheet-back').click();
    await page.locator('.ec-chip-summary').click();
    await page.locator('.ec-chip-item', { hasText: 'Guitar' }).click();
    await goToView(page, 'sheets');
    await expect(page.locator('.ec-sheet-row:not(.is-other)')).toHaveCount(1);
    await expect(page.locator('.ec-sheet-row.is-other')).toHaveCount(1);
  });

  test('a song open from another instrument falls back to the list', async ({ page }) => {
    await newSong(page, 'Guitar song');
    await setBody(page, '# Tuning\nE2, A2, D3, G3, B3, E4\n\n# Verse\nC | G');
    await expect(page.locator('#sheet-body')).toBeVisible();

    // Switching while a song is open must not render six-string shapes on four
    // strings — that used to throw and blank the screen.
    await addInstrument(page, { instrument: 'ukulele' });
    await goToView(page, 'sheets');
    await expect(page.locator('#sheet-body')).toHaveCount(0);
    await expect(page.locator('.ec-sheet-row.is-other')).toHaveCount(1);
  });
});

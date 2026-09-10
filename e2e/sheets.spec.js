import { test, expect, expectNoUnexpectedScrollbars } from './fixtures.js';
import { freshVisit, completeSetup, goToView, appState, addInstrument, dismissTutorial } from './helpers.js';

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
    await expect(page.locator('.ec-empty')).toContainText('No songs');

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

    // It comes back open for reading, which is what a song is usually open
    // for; the text is a click away and unchanged.
    await expect(page.locator('.ec-song-view .ec-print-title')).toHaveText('Blackbird');
    await page.locator('#sheet-edit').click();
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
    // First line: two measures, each holding two chords, one chord per cell.
    const firstLine = page.locator('.ec-song-line').first();
    await expect(firstLine.locator('.ec-chord-cell.is-measure-start')).toHaveCount(2);
    await expect(firstLine.locator('.ec-chord-cell .ec-measure-chord')).toHaveCount(4);
    // Second line: one chord per measure, so each spans its measure's columns.
    const secondLine = page.locator('.ec-song-line').nth(1);
    await expect(secondLine.locator('.ec-chord-cell')).toHaveCount(2);
    await expect(secondLine.locator('.ec-chord-cell').first()).toHaveAttribute('colspan', '2');
  });

  test('a chart of several sections and lines sits in its panel without scrollbars', async ({ page }) => {
    // The measures of a section are laid out in columns inside a box that may
    // scroll sideways for a long line — which makes it a scroll container on
    // both axes, so anything poking out of it vertically grows a scrollbar.
    await setBody(
      page,
      '# Verse\nG | Am7 | C | D\nG | Am7 | C | D\nEm | C | G | D\n\n' +
        '# Chorus\nC | G | Am | F\nC | G | F  G | C\n\n# Bridge\nAm | F | C | G'
    );
    await expect(page.locator('.ec-song-section')).toHaveCount(3);
    await expectNoUnexpectedScrollbars(page);
  });

  test('a symbol that is not a chord is reported, not silently dropped', async ({ page }) => {
    await setBody(page, 'C | wobble | G');
    await expect(page.getByRole('alert')).toContainText('Not a chord: wobble');
    await expect(page.locator('.ec-measure-chord.is-invalid')).toHaveCount(1);
  });
});

const CIFRA = [
  '[Intro] G  D  Em  C',
  '',
  '[Primeira Parte]',
  'G           D',
  'Quando eu te vi passar',
  'Em            C',
  'naquela tarde clara',
].join('\n');

test.describe('a song with words under the chords', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Cifra');
    await setBody(page, CIFRA);
  });

  test('reads the words as words and the chords as chords', async ({ page }) => {
    // None of it may be mistaken for a chord, which is what pasting one of
    // these into the old parser did to every word of it.
    await expect(page.locator('.ec-error')).toHaveCount(0);
    await expect(page.locator('.ec-song-section-name')).toHaveText(['Intro', 'Primeira Parte']);

    // The intro is a chart line: no words, so it keeps its columns.
    const intro = page.locator('.ec-song-section').first();
    await expect(intro.locator('.ec-song-line .ec-measure-chord')).toHaveText(['G', 'D', 'Em', 'C']);
    await expect(intro.locator('.ec-song-sung')).toHaveCount(0);

    // The verse is sung, and the words sit under the chord they belong to.
    const verse = page.locator('.ec-song-section').nth(1);
    await expect(verse.locator('.ec-song-sung')).toHaveCount(2);
    await expect(verse.locator('.ec-song-sung').first().locator('.ec-sung-words')).toHaveText([
      'Quando eu te',
      ' vi passar',
    ]);
  });

  test('a chord over the words can still be given a shape', async ({ page }) => {
    const verse = page.locator('.ec-song-section').nth(1);
    await verse.locator('.ec-measure-chord', { hasText: 'D' }).first().click();
    await expect(page.locator('#voicing-dialog')).toBeVisible();
    await page.locator('.ec-dialog-choice').first().click();

    // Written into the text as a voicings block, exactly as for a chart.
    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toContain('# Voicings: E2, A2, D3, G3, B3, E4');
    // And the words are untouched.
    expect(body).toContain('Quando eu te vi passar');
  });

  test('the printed sheet carries the words too', async ({ page }) => {
    // A sheet is played from. A verse without its words is no use on a stand.
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();

    const printRoot = page.locator('#print-root');
    await expect(printRoot.locator('.ec-print-sung')).toHaveCount(2);
    await expect(printRoot.locator('.ec-print-sung').first()).toContainText('Quando eu te');
    await expect(printRoot.locator('.ec-print-sung').first()).toContainText('vi passar');
    // The intro is still a chart, with its measures in columns.
    await expect(printRoot.locator('.ec-print-line .ec-print-cell')).toHaveText([
      'G',
      'D',
      'Em',
      'C',
    ]);
  });

  test('the printed sheet takes two columns when the song is narrow', async ({ page }) => {
    // A sung line is about a third the width of a page and there is one per
    // line of the song, so a single column spends pages on white space.
    // A wide intro over narrow verses, which is what a real cifra looks like.
    const verse = [
      'Gm             Gm/F',
      'Como fosse um par que',
      '            Em7/5-',
      'Nessa valsa triste',
    ].join('\n');
    await setBody(
      page,
      ['Intro: Fm  Fm/D#  Dm7/5-  C#7M  A#  F/A  D7', '', verse, '', verse, '', verse].join('\n')
    );
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();

    // The sections sit in a box of their own, and that box is what is broken
    // into columns; the title and the legend belong to the whole sheet. The
    // width is measured from the song, so it is whatever the longest sung line
    // needs; only that it was set can be asserted here.
    const body = page.locator('#print-root .ec-print-body');
    await expect(body).toHaveAttribute('style', /column-width:\s*\d+px/);

    // The intro is a chart, whose measures cannot wrap, and it is wider than a
    // verse. It spans both columns rather than forcing the whole sheet into one.
    await expect(page.locator('#print-root .ec-print-chart.is-full-width')).toHaveCount(1);

    // Laid out at the width of A4 inside its margins, it really is two columns,
    // and nothing has been squeezed until it overflows.
    const measured = await page.evaluate(() => {
      const root = document.getElementById('print-root');
      root.style.cssText = 'display:block;position:absolute;left:-9999px;top:0;width:680px';
      const count = getComputedStyle(root.querySelector('.ec-print-body')).columnCount;
      const overflowing = [...root.querySelectorAll('.ec-print-sung, .ec-print-chart')].filter(
        (e) => e.scrollWidth > e.clientWidth + 1
      ).length;
      root.style.cssText = '';
      return { count, overflowing };
    });
    expect(measured).toEqual({ count: '2', overflowing: 0 });
  });

  test('chords past the end of the words are not left touching', async ({ page }) => {
    // The segment model exists so that neither screen nor paper needs a
    // fixed-width font, which means no amount of typed spaces can be trusted to
    // hold two chords apart. The gap has to come from the layout.
    await setBody(page, '            Am       Am/G  F#m7/5-  F7M\nAo som dos bandolins');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();
    await page.emulateMedia({ media: 'print' });

    const tight = await page.evaluate(() => {
      const root = document.getElementById('print-root');
      root.style.cssText = 'display:block;position:absolute;left:-9999px;top:0;width:680px';
      // A chord with no words under it: its segment has to be wider than the
      // chord itself, or the next chord starts where this one ended.
      const touching = [...root.querySelectorAll('.ec-print-segment')]
        .filter((seg) => seg.querySelector('.ec-print-segment-words').textContent === '')
        .filter((seg) => {
          const text = seg.querySelector('.ec-print-segment-chord').firstChild;
          if (!text) return false;
          const range = document.createRange();
          range.selectNodeContents(text.parentNode);
          return seg.getBoundingClientRect().width <= range.getBoundingClientRect().width + 1;
        }).length;
      root.style.cssText = '';
      return touching;
    });
    expect(tight).toBe(0);
  });

  test('a bracketed repeat is shown, and none of it is a chord', async ({ page }) => {
    await setBody(page, 'Final:\n\n( Cm  Cm/A#  Am7/5-  G#7M )');
    await expect(page.locator('.ec-error')).toHaveCount(0);
    await expect(page.locator('.ec-song-section-name')).toHaveText(['Final']);

    // The brackets are on screen, and they are marks rather than buttons.
    await expect(page.locator('.ec-chord-mark')).toHaveText(['(', ')']);
    await expect(page.locator('.ec-measure-chord')).toHaveText([
      'Cm',
      'Cm/A#',
      'Am7/5-',
      'G#7M',
    ]);
    await expect(page.locator('.ec-measure-chord.is-invalid')).toHaveCount(0);
  });

  test('a plain chord chart is untouched by any of it', async ({ page }) => {
    await setBody(page, '# Verse\nC  Am | F  G | C');
    await expect(page.locator('.ec-song-sung')).toHaveCount(0);
    await expect(page.locator('.ec-song-line')).toHaveCount(1);
    await expect(page.locator('.ec-measure-chord')).toHaveText(['C', 'Am', 'F', 'G', 'C']);
  });
});

test.describe('reading a song', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Valsa');
    await setBody(page, CIFRA);
  });

  test('shows the song as it prints, with nothing to click', async ({ page }) => {
    // The reading view is the print preview: the same renderer draws both, so
    // it cannot drift from what comes out of the printer.
    await page.locator('#sheet-view').click();
    await expect(page.locator('.ec-song-view')).toBeVisible();
    await expect(page.locator('#sheet-body')).toHaveCount(0);
    await expect(page.locator('.ec-measure-chord')).toHaveCount(0);

    const view = page.locator('.ec-song-view');
    await expect(view.locator('.ec-print-title')).toHaveText('Valsa');
    await expect(view.locator('.ec-print-section-name')).toHaveText(['Intro', 'Primeira Parte']);
    await expect(view.locator('.ec-print-sung')).toHaveCount(2);
    await expect(view.locator('svg.ec-diagram')).toHaveCount(4);
  });

  test('breaks into columns the way the printed sheet does', async ({ page }) => {
    await page.locator('#sheet-view').click();
    // Measured from the song and set on the box that holds the sections, as in
    // print. Without a cap here: on screen there is no page to turn.
    await expect(page.locator('.ec-song-view .ec-print-body')).toHaveAttribute(
      'style',
      /column-width:\s*\d+px/
    );
  });

  test('is where a song opens from the list, with editing a button away', async ({ page }) => {
    await page.locator('#sheet-back').click();
    await page.getByRole('button', { name: 'View Valsa' }).click();
    await expect(page.locator('.ec-song-view')).toBeVisible();

    await page.locator('#sheet-edit').click();
    await expect(page.locator('#sheet-body')).toBeVisible();

    await page.locator('#sheet-view').click();
    await expect(page.locator('.ec-song-view')).toBeVisible();
  });

  test('opens straight into the editor when that is what was asked for', async ({ page }) => {
    await page.locator('#sheet-back').click();
    await page.getByRole('button', { name: 'Edit Valsa' }).click();
    await expect(page.locator('#sheet-body')).toBeVisible();
  });

  test('turns a page at a time, and puts it in the clear', async ({ page }) => {
    // Playing from a screen wants the next page, not fourteen lines further
    // down, so the arrows land a whole page below the header rather than
    // scrolling by some amount and leaving you to find your place.
    const verse = [
      'Gm             Gm/F',
      'Como fosse um par que',
      '            Em7/5-',
      'Nessa valsa triste',
    ].join('\n');
    // Long enough to spill over, even on a wide screen where a page holds
    // several columns.
    await setBody(page, ['[Verso]', ...Array.from({ length: 70 }, () => `${verse}\n`)].join('\n'));
    await page.locator('#sheet-view').click();

    const sheets = page.locator('.ec-song-page');
    expect(await sheets.count()).toBeGreaterThan(1);
    const total = await sheets.count();

    const pager = page.locator('.ec-pager');
    await expect(pager).toBeVisible();
    await expect(page.locator('.ec-pager-count')).toHaveText(`1/${total}`);
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    // The turn is animated, so wait for it to land: the page it turned to sits
    // at the top of the window, not near it. Nothing is pinned over it — the
    // header scrolls away like everything else.
    const settledOn = (n) =>
      page.waitForFunction((index) => {
        const sheet = document.querySelectorAll('.ec-song-page')[index];
        return Math.abs(sheet.getBoundingClientRect().top) <= 2;
      }, n);

    await page.getByRole('button', { name: 'Next page' }).click();
    await settledOn(1);
    await expect(page.locator('.ec-pager-count')).toHaveText(`2/${total}`);

    await page.getByRole('button', { name: 'Previous page' }).click();
    await settledOn(0);
    await expect(page.locator('.ec-pager-count')).toHaveText(`1/${total}`);

    // Scrolled by hand and left halfway: the middle of the pager puts the page
    // back where it belongs.
    await page.evaluate(() => window.scrollBy(0, 140));
    await page.waitForFunction(
      () => Math.abs(document.querySelectorAll('.ec-song-page')[0].getBoundingClientRect().top) > 50
    );
    await page.getByRole('button', { name: 'Line this page up' }).click();
    await settledOn(0);
  });

  test('offers no pager for a song that fits on one page', async ({ page }) => {
    await page.locator('#sheet-view').click();
    await expect(page.locator('.ec-song-page')).toHaveCount(1);
    await expect(page.locator('.ec-pager')).toHaveCount(0);
  });

  test('never leaves a page with more on it than fits', async ({ page }) => {
    // The whole point of filling pages by hand: nothing may be cut off at the
    // fold, on any page.
    const verse = ['Gm             Gm/F', 'Como fosse um par que'].join('\n');
    await setBody(page, ['[Verso]', ...Array.from({ length: 40 }, () => `${verse}\n`)].join('\n'));
    await page.locator('#sheet-view').click();
    await expect(page.locator('.ec-song-page').first()).toBeVisible();

    const spilling = await page.evaluate(
      () =>
        [...document.querySelectorAll('.ec-song-page .ec-print-body')].filter(
          (body) =>
            body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1
        ).length
    );
    expect(spilling).toBe(0);
  });

  test('can be shared and printed from the reading view', async ({ page }) => {
    await page.locator('#sheet-view').click();
    await page.locator('#sheet-share').click();
    await expect(page.locator('.ec-share-link')).toHaveValue(/#s=/);

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();
    await expect(page.locator('#print-root .ec-print-title')).toHaveText('Valsa');
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
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-card-chord')).toHaveCount(2);
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-card-chord').nth(1)).toHaveText('Cm[2]');
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
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-card-chord')).toHaveCount(1);
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
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(2);
    await expect(page.locator('.ec-footnote')).toHaveText('2');
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-shorthand').first()).toHaveText('x35543');
  });

  test('a hand-written block in any order still displays sorted', async ({ page }) => {
    await setBody(
      page,
      'G | Am | C\n\n---\n\n# Voicings: E2, A2, D3, G3, B3, E4\nG = 320003\nC = x32010\nAm = x02210'
    );

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
    // G, because a group only offers "Show all" when it holds more shapes than
    // it displays, and G minor no longer has a position that crowded: the
    // search stopped offering shapes that mute a string for nothing (§5.2).
    await setBody(page, 'G | C');
    await page.locator('.ec-measure-chord', { hasText: 'G' }).first().click();
    const dialog = page.locator('#voicing-dialog');
    // Whichever group overflows, for the same reason as the explorer test.
    const overflowing = dialog
      .locator('.ec-group', { has: page.getByRole('button', { name: /Show all/ }) })
      .first();
    await expect(overflowing).toBeVisible();
    // Pinned by heading id, for the same reason as the explorer test.
    const id = await overflowing.getAttribute('aria-labelledby');
    const first = dialog.locator(`.ec-group[aria-labelledby="${id}"]`);
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
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(1);
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-used-in')).toHaveText('3\u00d7');
    const before = await page.locator('#sheet-body').inputValue();
    const firstShape = /^Cm = (\S+)$/m.exec(before)[1];

    // Change the shape itself.
    await page.locator('.ec-voicings .ec-card:not(.is-default) .ec-voicing-choice').click();
    await expect(page.locator('#voicing-dialog')).toContainText('Change Cm everywhere');
    await expect(page.locator('#voicing-dialog')).toContainText('in 3 places');
    await page.locator('.ec-dialog-choice').nth(2).click();

    const after = await page.locator('#sheet-body').inputValue();
    const newShape = /^Cm = (\S+)$/m.exec(after)[1];
    expect(newShape).not.toBe(firstShape);

    // All three moved together, and no footnote was introduced.
    expect(after.split('\n')[0]).toBe('Cm | A | Cm | Cm');
    expect(after).not.toContain('Cm[2]');
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default) .ec-used-in')).toHaveText('3\u00d7');
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
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(1);

    await page.locator('.ec-voicings .ec-card:not(.is-default) .ec-voicing-choice').click();
    await page.getByRole('button', { name: 'Clear everywhere' }).click();

    const after = await page.locator('#sheet-body').inputValue();
    expect(after).not.toContain('# Voicings');
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(0);
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

test.describe('default voicings', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
    await newSong(page, 'Defaults');
  });

  test('every chord has a shape before anything is chosen', async ({ page }) => {
    await setBody(page, 'C | G | Am | F');
    // Nothing in the text yet...
    expect(await page.locator('#sheet-body').inputValue()).not.toContain('# Voicings');
    // ...but every chord already has a diagram, marked as a default.
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(4);
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(4);
    await expect(page.locator('.ec-badge-default')).toHaveCount(4);
    await expect(page.locator('.ec-measure-chord.is-default')).toHaveCount(4);
  });

  test('the default is what the explorer shows first', async ({ page }) => {
    await setBody(page, 'C');
    const inSong = await page.locator('.ec-voicings .ec-shorthand').first().textContent();

    await goToView(page, 'explore');
    await page.fill('#chord-input', 'C');
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    const inExplorer = await page.locator('.ec-results .ec-shorthand').first().textContent();
    expect(inSong).toBe(inExplorer);
  });

  test('choosing a shape writes only that one into the text', async ({ page }) => {
    await setBody(page, 'C | G');
    await page.locator('.ec-measure-chord', { hasText: /^G$/ }).first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();

    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toMatch(/^G = \S+$/m);
    // C was never chosen, so it is not written: the text carries only choices.
    expect(body).not.toMatch(/^C = /m);
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(1);
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(1);
  });

  test('clearing a choice falls back to the default', async ({ page }) => {
    await setBody(page, 'C');
    const defaultShape = await page.locator('.ec-voicings .ec-shorthand').first().textContent();

    await page.locator('.ec-measure-chord', { hasText: 'C' }).first().click();
    await page.locator('.ec-dialog-choice').nth(2).click();
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(0);

    await page.locator('.ec-measure-chord', { hasText: 'C' }).first().click();
    await page.locator('#voicing-clear').click();
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(1);
    await expect(page.locator('.ec-voicings .ec-shorthand').first()).toHaveText(defaultShape);
  });

  test('the picker opens on the default, so you see what is in effect', async ({ page }) => {
    await setBody(page, 'C');
    await page.locator('.ec-measure-chord', { hasText: 'C' }).first().click();
    await expect(page.locator('.ec-dialog-choice.is-chosen')).toHaveCount(1);
    // But nothing was chosen, so there is nothing to clear.
    await expect(page.locator('#voicing-clear')).toHaveCount(0);
  });

  test('a chord that cannot be voiced says so rather than showing nothing', async ({ page }) => {
    await page.locator('#sheet-back').click();
    await addInstrument(page, { instrument: 'ukulele' });
    await goToView(page, 'sheets');
    await page.fill('#new-sheet-title', 'Uke');
    await page.getByRole('button', { name: 'New song' }).click();
    await setBody(page, 'C | C13#11');
    await expect(page.locator('#sheet-missing')).toContainText('C13#11');
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(1);
  });

  test('defaults print like any other shape', async ({ page }) => {
    await setBody(page, '# Verse\nC | G');
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.locator('#sheet-print').click();
    await expect(page.locator('#print-root .ec-print-chord')).toHaveCount(2);
    await expect(page.locator('#print-root svg.ec-diagram')).toHaveCount(2);
    await expect(page.locator('#print-root .ec-badge-default')).toHaveCount(0);
  });
});

test.describe('saved shapes flow into songs', () => {
  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  /** Star the nth shape shown for a chord and return its shorthand. */
  async function star(page, symbol, nth) {
    await goToView(page, 'explore');
    await page.fill('#chord-input', symbol);
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.locator('.ec-results .ec-card').nth(nth)).toBeVisible();
    const shorthand = await page.locator('.ec-results .ec-shorthand').nth(nth).textContent();
    await page.locator('.ec-star').nth(nth).click();
    return shorthand;
  }

  test('a saved shape that differs from the default is written into a new song', async ({
    page,
  }) => {
    // The second shape shown, not the first: the first is the default and
    // would not be worth writing.
    const shape = await star(page, 'C', 1);
    await newSong(page, 'Lesson'); // the starter chart contains a C

    expect(await page.locator('#sheet-body').inputValue()).toContain(`C = ${shape}`);
    const card = page.locator('.ec-voicings .ec-card[data-key="C"]');
    await expect(card).toHaveCount(1);
    await expect(card).not.toHaveClass(/is-default/);
  });

  test('a saved shape that is the default anyway is not written', async ({ page }) => {
    await star(page, 'G', 0);
    await newSong(page, 'Lesson');
    expect(await page.locator('#sheet-body').inputValue()).not.toMatch(/^G = /m);
    await expect(page.locator('.ec-voicings .ec-card.is-default[data-key="G"]')).toHaveCount(1);
  });

  test('a chord entering the song later gets its saved shape then', async ({ page }) => {
    const shape = await star(page, 'Am', 1);
    await newSong(page, 'Lesson');
    await setBody(page, '# Verse\nC | G');
    expect(await page.locator('#sheet-body').inputValue()).not.toContain('Am');

    await setBody(page, '# Verse\nC | G | Am');
    expect(await page.locator('#sheet-body').inputValue()).toContain(`Am = ${shape}`);
  });

  test('clearing a saved shape from a song does not bring it back', async ({ page }) => {
    await star(page, 'C', 1);
    await newSong(page, 'Lesson');
    expect(await page.locator('#sheet-body').inputValue()).toMatch(/^C = /m);

    await page.locator('.ec-measure-chord', { hasText: /^C$/ }).first().click();
    await page.locator('#voicing-clear').click();
    expect(await page.locator('#sheet-body').inputValue()).not.toMatch(/^C = /m);

    // A later edit that does not introduce C must leave it cleared.
    const body = await page.locator('#sheet-body').inputValue();
    await setBody(page, `${body.trim()}\n\n# Chorus\nG`);
    expect(await page.locator('#sheet-body').inputValue()).not.toMatch(/^C = /m);
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
    await expect(printRoot.locator('.ec-print-line .ec-print-cell')).toHaveText(['C', 'G']);

    // Under print media the song is what shows, and the app is not.
    await page.emulateMedia({ media: 'print' });
    await expect(printRoot).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // The chart is what gets read while playing, so it comes before the shapes.
    const legendBox = await printRoot.locator('.ec-print-legend').boundingBox();
    const chartBox = await printRoot.locator('.ec-print-section').first().boundingBox();
    expect(chartBox.y).toBeLessThan(legendBox.y);
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
    await dismissTutorial(other);
    await other.goto(link);

    // The song carries its own instrument, so the viewing-as bar appears rather
    // than the song being silently retuned.
    await expect(other.locator('.ec-viewas')).toBeVisible();

    const state = await appState(other);
    expect(state.view).toBe('sheets');
    expect(state.sheetCount).toBe(1);
    // The voicings travelled because they are part of the text.
    expect(state.body).toContain('Cm[2] = 8-10-10-8-8-8');
    // A song arriving by link opens to be read, not to be edited.
    await expect(other.locator('.ec-song-view .ec-print-title')).toHaveText('Shared song');
    await context.close();
  });
});

test.describe('one song, every instrument', () => {
  const GUITAR = 'E2, A2, D3, G3, B3, E4';
  const UKE = 'G4, C4, E4, A4';

  test.beforeEach(async ({ page }) => {
    await freshVisit(page);
    await completeSetup(page, { instrument: '6guitar' });
  });

  test('a new song carries no tuning until a voicing is chosen', async ({ page }) => {
    await newSong(page, 'Guitar song');
    expect(await page.locator('#sheet-body').inputValue()).not.toContain('# Voicings');

    await page.locator('.ec-measure-chord', { hasText: /^C$/ }).first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();

    // The voicings sit after a rule, in a block labelled with the tuning.
    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toMatch(/\n---\n/);
    expect(body).toContain(`# Voicings: ${GUITAR}`);
    expect(body.indexOf('---')).toBeLessThan(body.indexOf('# Voicings'));
  });

  test('the same song serves every instrument, each with its own voicings', async ({ page }) => {
    await newSong(page, 'Shared song');
    await setBody(page, '# Verse\nC | G');
    await page.locator('.ec-measure-chord', { hasText: /^C$/ }).first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();
    // Back to the list first: an open song stays open across an instrument
    // switch (the next test checks exactly that), and here the list is wanted.
    await page.locator('#sheet-back').click();

    await addInstrument(page, { instrument: 'ukulele', name: 'Uke' });
    await goToView(page, 'sheets');

    // Listed here too — it is the same song — and, having no ukulele block
    // yet, it opens with every chord on its default.
    await expect(page.locator('.ec-sheet-row')).toHaveCount(1);
    await expect(page.locator('.ec-sheet-voiced')).toContainText('Guitar');
    await page.getByRole('button', { name: 'Edit Shared song' }).click();
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(2);

    // Choosing here writes a second block, leaving the guitar one alone.
    await page.locator('.ec-measure-chord', { hasText: /^C$/ }).first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();
    const body = await page.locator('#sheet-body').inputValue();
    expect(body).toContain(`# Voicings: ${GUITAR}`);
    expect(body).toContain(`# Voicings: ${UKE}`);
    expect(body.match(/^C = /gm)).toHaveLength(2);

    await page.locator('#sheet-back').click();
    await expect(page.locator('.ec-sheet-voiced')).toContainText('Uke');
  });

  test('a song stays open across an instrument switch and renders on the new one', async ({
    page,
  }) => {
    await newSong(page, 'Open song');
    await setBody(page, 'C | G | Am');
    await page.locator('.ec-measure-chord', { hasText: /^C$/ }).first().click();
    await page.locator('.ec-dialog-choice').nth(1).click();

    // Six-string shapes must not be drawn on four strings; the chart simply
    // shows ukulele defaults instead.
    await addInstrument(page, { instrument: 'ukulele' });
    await goToView(page, 'sheets');
    await expect(page.locator('#sheet-body')).toBeVisible();
    await expect(page.locator('.ec-voicings .ec-card')).toHaveCount(3);
    await expect(page.locator('.ec-voicings .ec-card.is-default')).toHaveCount(3);
  });

  test('a song pasted in the earlier form is converted when saved', async ({ page }) => {
    await newSong(page, 'Old song');
    await setBody(page, `# Tuning\n${GUITAR}\n\n# Verse\nC | G\n\n# Voicings\nC = x32010`);

    const body = await page.locator('#sheet-body').inputValue();
    expect(body).not.toContain('# Tuning');
    expect(body).toContain('---');
    expect(body).toContain(`# Voicings: ${GUITAR}`);
    expect(body).toContain('C = x32010');
    // And it is understood: C is a choice, not a default.
    await expect(page.locator('.ec-voicings .ec-card:not(.is-default)')).toHaveCount(1);
    await expect(page.locator('.ec-song-section-name')).toHaveText('Verse');
  });

  test('an unlabelled block is taken to be for the instrument in use', async ({ page }) => {
    await newSong(page, 'Bare song');
    await setBody(page, 'C | G\n\n# Voicings\nC = x32010');
    expect(await page.locator('#sheet-body').inputValue()).toContain(`# Voicings: ${GUITAR}`);
  });
});
